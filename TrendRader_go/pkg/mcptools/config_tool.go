package mcptools

import (
	"context"
	"encoding/json"

	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type ConfigTool struct {
	Env *app.Environment
}

func (t *ConfigTool) Name() string {
	return "get_current_config"
}

func (t *ConfigTool) Description() string {
	return "返回当前加载的 config/config.yaml 内容，敏感字段请勿直接暴露。"
}

func (t *ConfigTool) InputSchema() map[string]interface{} {
	return map[string]interface{}{
		"type":                 "object",
		"additionalProperties": false,
	}
}

func (t *ConfigTool) Call(ctx context.Context, _ json.RawMessage) (interface{}, error) {
	return t.Env.Config, nil
}
