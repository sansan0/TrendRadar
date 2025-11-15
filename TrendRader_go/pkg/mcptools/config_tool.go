package mcptools

import "github.com/sansan0/TrendRadar/go/pkg/app"

func CurrentConfig(env *app.Environment) interface{} {
	return env.Config
}
