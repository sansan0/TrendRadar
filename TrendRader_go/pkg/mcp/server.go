package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
)

type Tool interface {
	Name() string
	Description() string
	InputSchema() map[string]interface{}
	Call(ctx context.Context, args json.RawMessage) (interface{}, error)
}

type Server struct {
	tools map[string]Tool
	r     *bufio.Reader
	w     *bufio.Writer
	mu    sync.Mutex
}

func NewServer(r io.Reader, w io.Writer) *Server {
	return &Server{
		tools: make(map[string]Tool),
		r:     bufio.NewReader(r),
		w:     bufio.NewWriter(w),
	}
}

func (s *Server) Register(tool Tool) {
	s.tools[tool.Name()] = tool
}

func (s *Server) Serve(ctx context.Context) error {
	for {
		frame, err := s.readFrame()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}

		var req request
		if err := json.Unmarshal(frame, &req); err != nil {
			// best effort error response
			s.writeError(nil, -32700, fmt.Sprintf("解析请求失败: %v", err))
			continue
		}

		if len(req.ID) == 0 {
			// notification，直接忽略
			if req.Method == "shutdown" {
				return nil
			}
			continue
		}

		if err := s.handleRequest(ctx, &req); err != nil {
			return err
		}
	}
}

func (s *Server) handleRequest(ctx context.Context, req *request) error {
	switch req.Method {
	case "initialize":
		return s.writeResponse(req.ID, map[string]interface{}{
			"protocolVersion": "1.0.0",
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{},
			},
		})
	case "ping":
		return s.writeResponse(req.ID, map[string]interface{}{})
	case "shutdown":
		return s.writeResponse(req.ID, map[string]interface{}{})
	case "tools/list":
		return s.listTools(req)
	case "tools/call":
		return s.callTool(ctx, req)
	default:
		return s.writeError(req.ID, -32601, fmt.Sprintf("未支持的方法: %s", req.Method))
	}
}

func (s *Server) listTools(req *request) error {
	defs := make([]map[string]interface{}, 0, len(s.tools))
	for _, tool := range s.tools {
		defs = append(defs, map[string]interface{}{
			"name":        tool.Name(),
			"description": tool.Description(),
			"inputSchema": tool.InputSchema(),
		})
	}

	return s.writeResponse(req.ID, map[string]interface{}{
		"tools": defs,
	})
}

func (s *Server) callTool(ctx context.Context, req *request) error {
	var params struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.writeError(req.ID, -32602, fmt.Sprintf("参数解析失败: %v", err))
	}

	tool, ok := s.tools[params.Name]
	if !ok {
		return s.writeError(req.ID, -32601, fmt.Sprintf("工具不存在: %s", params.Name))
	}

	result, err := tool.Call(ctx, params.Arguments)
	if err != nil {
		return s.writeError(req.ID, -32000, err.Error())
	}

	payload, err := json.Marshal(result)
	if err != nil {
		return s.writeError(req.ID, -32001, fmt.Sprintf("结果编码失败: %v", err))
	}

	content := []map[string]interface{}{
		{
			"type": "text",
			"text": string(payload),
		},
	}

	return s.writeResponse(req.ID, map[string]interface{}{
		"content": content,
	})
}

func (s *Server) readFrame() ([]byte, error) {
	var contentLength int
	for {
		line, err := s.r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if line == "" {
			break
		}
		if strings.HasPrefix(strings.ToLower(line), "content-length:") {
			fmt.Sscanf(line, "Content-Length: %d", &contentLength)
		}
	}

	if contentLength <= 0 {
		return nil, fmt.Errorf("无效的Content-Length: %d", contentLength)
	}

	buf := make([]byte, contentLength)
	if _, err := io.ReadFull(s.r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func (s *Server) writeResponse(id json.RawMessage, result interface{}) error {
	resp := response{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
	return s.writeMessage(resp)
}

func (s *Server) writeError(id json.RawMessage, code int, message string) error {
	resp := response{
		JSONRPC: "2.0",
		ID:      id,
		Error: &rpcError{
			Code:    code,
			Message: message,
		},
	}
	return s.writeMessage(resp)
}

func (s *Server) writeMessage(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := fmt.Fprintf(s.w, "Content-Length: %d\r\n\r\n", len(data)); err != nil {
		return err
	}
	if _, err := s.w.Write(data); err != nil {
		return err
	}
	return s.w.Flush()
}

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  interface{}     `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
