{{/*
Chart 名称
*/}}
{{- define "trendradar.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
全限定名 (release-name-chart-name)
*/}}
{{- define "trendradar.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart 版本标签
*/}}
{{- define "trendradar.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
公共标签
*/}}
{{- define "trendradar.labels" -}}
helm.sh/chart: {{ include "trendradar.chart" . }}
{{ include "trendradar.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
选择器标签
*/}}
{{- define "trendradar.selectorLabels" -}}
app.kubernetes.io/name: {{ include "trendradar.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MCP 全限定名
*/}}
{{- define "trendradar.mcp.fullname" -}}
{{- printf "%s-mcp" (include "trendradar.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
MCP 选择器标签
*/}}
{{- define "trendradar.mcp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "trendradar.name" . }}-mcp
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MCP 公共标签
*/}}
{{- define "trendradar.mcp.labels" -}}
helm.sh/chart: {{ include "trendradar.chart" . }}
{{ include "trendradar.mcp.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.imageMcp.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Config 卷名
*/}}
{{- define "trendradar.configVolumeName" -}}
{{- printf "%s-config" (include "trendradar.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Output 卷名
*/}}
{{- define "trendradar.outputVolumeName" -}}
{{- printf "%s-output" (include "trendradar.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
