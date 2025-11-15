package crawler

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	cfgpkg "github.com/sansan0/TrendRadar/pkg/config"
)

const (
	defaultRequestTimeout = 10 * time.Second
	maxRetries            = 2
	minRetryWait          = 3 * time.Second
	maxRetryWait          = 5 * time.Second
	defaultAPIBase        = "https://newsnow.busiyi.world"
)

type apiResponse struct {
	Status string `json:"status"`
	Items  []struct {
		Title     string `json:"title"`
		URL       string `json:"url"`
		MobileURL string `json:"mobileUrl"`
	} `json:"items"`
}

// TitleInfo mirrors Python的数据结构。
type TitleInfo struct {
	Ranks     []int  `json:"ranks"`
	URL       string `json:"url"`
	MobileURL string `json:"mobileUrl"`
}

// CrawlOutput 保存一次抓取的全部信息。
type CrawlOutput struct {
	Results   map[string]map[string]*TitleInfo
	IDToName  map[string]string
	FailedIDs []string
}

// Fetcher 负责按配置抓取平台数据。
type Fetcher struct {
	client          *http.Client
	requestInterval time.Duration
	random          *rand.Rand
	useProxy        bool
	baseURL         string
}

func NewFetcher(cfg *cfgpkg.Config) (*Fetcher, error) {
	return newFetcherWithBaseURL(cfg, defaultAPIBase)
}

func newFetcherWithBaseURL(cfg *cfgpkg.Config, baseURL string) (*Fetcher, error) {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	if cfg.Crawler.UseProxy && cfg.Crawler.DefaultProxy != "" {
		proxyURL, err := url.Parse(cfg.Crawler.DefaultProxy)
		if err != nil {
			return nil, fmt.Errorf("解析代理失败: %w", err)
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	client := &http.Client{
		Timeout:   defaultRequestTimeout,
		Transport: transport,
	}

	return &Fetcher{
		client:          client,
		requestInterval: time.Duration(cfg.Crawler.RequestInterval) * time.Millisecond,
		random:          rand.New(rand.NewSource(time.Now().UnixNano())),
		useProxy:        cfg.Crawler.UseProxy && cfg.Crawler.DefaultProxy != "",
		baseURL:         strings.TrimRight(baseURL, "/"),
	}, nil
}

// CrawlPlatforms 顺序抓取配置的平台列表。
func (f *Fetcher) CrawlPlatforms(ctx context.Context, platforms []cfgpkg.PlatformConfig) (*CrawlOutput, error) {
	results := make(map[string]map[string]*TitleInfo, len(platforms))
	idToName := make(map[string]string, len(platforms))
	var failed []string

	for idx, platform := range platforms {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		idToName[platform.ID] = platform.Name

		resp, err := f.fetchPlatform(ctx, platform.ID)
		if err != nil {
			failed = append(failed, platform.ID)
		} else if len(resp.Items) == 0 {
			failed = append(failed, platform.ID)
		} else {
			results[platform.ID] = mergeItems(resp.Items)
			fmt.Printf("获取 %s 成功（%d 条）\n", platform.ID, len(resp.Items))
		}

		if idx < len(platforms)-1 {
			f.sleepWithJitter()
		}
	}

	return &CrawlOutput{
		Results:   results,
		IDToName:  idToName,
		FailedIDs: failed,
	}, nil
}

func (f *Fetcher) fetchPlatform(ctx context.Context, platformID string) (*apiResponse, error) {
	requestURL := fmt.Sprintf("%s/api/s?id=%s&latest", f.baseURL, platformID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "TrendRadar-Go/0.1 (+https://github.com/sansan0/TrendRadar)")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Cache-Control", "no-cache")

	var resp *http.Response
	for attempt := 0; attempt <= maxRetries; attempt++ {
		resp, err = f.client.Do(req)
		if err == nil && resp.StatusCode < 500 {
			break
		}
		wait := minRetryWait + time.Duration(attempt)*time.Second + time.Duration(f.random.Intn(2000))*time.Millisecond
		fmt.Printf("请求 %s 失败（尝试 %d/%d）: %v，%v 后重试\n", platformID, attempt+1, maxRetries+1, err, wait)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(wait):
		}
	}
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("平台 %s 返回状态码 %d", platformID, resp.StatusCode)
	}

	var parsed apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("解析平台 %s 响应失败: %w", platformID, err)
	}

	if parsed.Status != "success" && parsed.Status != "cache" {
		return nil, fmt.Errorf("平台 %s 返回状态 %s", platformID, parsed.Status)
	}

	return &parsed, nil
}

func (f *Fetcher) sleepWithJitter() {
	if f.requestInterval <= 0 {
		return
	}
	jitter := time.Duration(f.random.Intn(31)-10) * time.Millisecond
	delay := f.requestInterval + jitter
	if delay < 50*time.Millisecond {
		delay = 50 * time.Millisecond
	}
	time.Sleep(delay)
}

func mergeItems(items []struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	MobileURL string `json:"mobileUrl"`
}) map[string]*TitleInfo {
	result := make(map[string]*TitleInfo, len(items))
	for idx, item := range items {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}

		info, ok := result[title]
		if !ok {
			info = &TitleInfo{
				Ranks:     []int{idx + 1},
				URL:       item.URL,
				MobileURL: item.MobileURL,
			}
			result[title] = info
			continue
		}

		info.Ranks = append(info.Ranks, idx+1)
		if info.URL == "" {
			info.URL = item.URL
		}
		if info.MobileURL == "" {
			info.MobileURL = item.MobileURL
		}
	}
	return result
}
