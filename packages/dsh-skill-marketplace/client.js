window.__ModuleLoader__.load({
  id: '@dsh-skill-market/dsh-skill-marketplace',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const STYLE_ID = '@dsh-skill-market/dsh-skill-marketplace/client.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = '@dsh-skill-market/dsh-skill-marketplace'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = `
.dshm-root { color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.5; }
.dshm-toolbar { display: flex; gap: 10px; margin-bottom: 12px; }
.dshm-input { flex: 1; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); border-radius: 8px; height: 34px; padding: 0 12px; font: inherit; }
.dshm-input:focus-visible { border-color: var(--dsw-alias-brand-primary); outline: none; }
.dshm-refresh { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 0 12px; cursor: pointer; }
.dshm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.dshm-card { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-module-platform); border-radius: 10px; padding: 12px; }
.dshm-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 6px; font-weight: 600; }
.dshm-version { color: var(--dsw-alias-label-tertiary); font-weight: 400; font-size: 11px; }
.dshm-desc { color: var(--dsw-alias-label-secondary); margin: 0 0 10px; min-height: 40px; }
.dshm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dshm-button { font: inherit; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
.dshm-button:hover { border-color: var(--dsw-alias-brand-primary); }
.dshm-button-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: #fff; }
.dshm-detail { margin-top: 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; padding: 12px; }
.dshm-detail h3 { margin: 0 0 6px; }
.dshm-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dshm-pre { white-space: pre-wrap; background: var(--dsw-alias-bg-layer-3); border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 10px; max-height: 360px; overflow: auto; font: 12px/1.5 ui-monospace, Consolas, monospace; color: var(--dsw-alias-label-primary); }
.dshm-empty { color: var(--dsw-alias-label-tertiary); padding: 30px 0; text-align: center; }
.dshm-error { color: var(--dsw-alias-label-error); padding: 20px 0; text-align: center; }
.dshm-note { color: var(--dsw-alias-label-tertiary); font-size: 12px; margin: 10px 0 0; }
`
      document.head.appendChild(tag)
    }

    const inject = ['slots']
    const NS = 'dsh-skill-marketplace'

    function MarketplaceTab() {
      const [skills, setSkills] = React.useState([])
      const [query, setQuery] = React.useState('')
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [selected, setSelected] = React.useState(null)
      const [copied, setCopied] = React.useState('')

      const endpoint = window.DSH_SKILL_MARKET_ENDPOINT || 'http://127.0.0.1:3081'

      const load = React.useCallback(async () => {
        setLoading(true)
        setError('')
        try {
          const response = await fetch(endpoint + '/api/v1/skills?sort=downloads', {
            headers: { accept: 'application/json' },
          })
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const payload = await response.json()
          setSkills(Array.isArray(payload.skills) ? payload.skills : [])
        } catch (cause) {
          setError('无法连接技能市场 ' + endpoint + '：' + (cause && cause.message ? cause.message : cause))
        } finally {
          setLoading(false)
        }
      }, [endpoint])

      React.useEffect(() => { void load() }, [load])

      const filtered = skills.filter((skill) => {
        if (!query.trim()) return true
        const haystack = [skill.name, skill.description, skill.whenToUse || '', (skill.tags || []).join(' ')]
          .join(' ').toLowerCase()
        return haystack.includes(query.trim().toLowerCase())
      })

      const copyInstall = async (skill) => {
        const command = 'dsh-market install ' + skill.name
        try {
          await navigator.clipboard.writeText(command)
          setCopied(skill.name)
          window.setTimeout(() => setCopied(''), 1500)
        } catch {
          setCopied('')
        }
      }

      const openDetail = async (skill) => {
        setSelected(skill)
        try {
          const response = await fetch(endpoint + '/api/v1/skills/' + encodeURIComponent(skill.name) + '/content')
          if (response.ok) {
            const content = await response.text()
            setSelected({ ...skill, content })
          }
        } catch {
          setSelected({ ...skill, content: '正文加载失败。' })
        }
      }

      return React.createElement('div', { className: 'dshm-root' },
        React.createElement('div', { className: 'dshm-toolbar' },
          React.createElement('input', {
            className: 'dshm-input',
            placeholder: '搜索市场技能…',
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          React.createElement('button', { className: 'dshm-refresh', onClick: () => void load() }, loading ? '加载中…' : '刷新'),
        ),
        error
          ? React.createElement('div', { className: 'dshm-error' }, error,
              React.createElement('div', { className: 'dshm-note' }, '请在插件配置中把 endpoint 指向公开市场地址，并确认市场服务已启动。'))
          : loading
            ? React.createElement('div', { className: 'dshm-empty' }, '正在从市场加载技能…')
            : filtered.length === 0
              ? React.createElement('div', { className: 'dshm-empty' }, '没有匹配的技能。')
              : React.createElement('div', { className: 'dshm-grid' },
                  filtered.map((skill) => React.createElement('article', { key: skill.name, className: 'dshm-card' },
                    React.createElement('h4', { className: 'dshm-name' },
                      skill.name,
                      React.createElement('span', { className: 'dshm-version' }, 'v' + skill.version)),
                    React.createElement('p', { className: 'dshm-desc' }, skill.description),
                    React.createElement('div', { className: 'dshm-actions' },
                      React.createElement('button', { className: 'dshm-button', onClick: () => void openDetail(skill) }, '预览'),
                      React.createElement('button', {
                        className: 'dshm-button' + (copied === skill.name ? ' dshm-button-primary' : ''),
                        onClick: () => void copyInstall(skill),
                      }, copied === skill.name ? '已复制' : '复制安装命令'),
                      React.createElement('a', {
                        className: 'dshm-button',
                        href: endpoint + '/',
                        target: '_blank',
                        rel: 'noreferrer',
                        style: { textDecoration: 'none' },
                      }, '打开市场'),
                    ),
                  ))),
        selected ? React.createElement('section', { className: 'dshm-detail' },
          React.createElement('h3', null, selected.name, ' · v' + selected.version),
          React.createElement('div', { className: 'dshm-meta' },
            React.createElement('span', null, selected.author || 'anonymous'),
            React.createElement('span', null, selected.license || 'MIT'),
            React.createElement('span', null, String(selected.downloads || 0) + ' 次安装'),
            selected.invocation && selected.invocation.modelInvocable === false
              ? React.createElement('span', null, '仅用户可调用')
              : React.createElement('span', null, '模型可调用')),
          React.createElement('pre', { className: 'dshm-pre' }, selected.content || '加载中…'),
        ) : null,
        React.createElement('p', { className: 'dshm-note' },
          '远程 provider 启用后，这里的技能会出现在会话的 <available_skills> 目录中；本地安装请复制命令后在终端执行 dsh-market。'),
      )
    }

    function apply(ctx, config) {
      if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function') {
        if (ctx && ctx.logger && ctx.logger.warn) ctx.logger.warn('[dsh-skill-marketplace] 客户端 slots 服务不可用，跳过设置页注册')
        return
      }
      const endpoint = (config && config.endpoint) || window.DSH_SKILL_MARKET_ENDPOINT || 'http://127.0.0.1:3081'
      if (typeof window !== 'undefined') window.DSH_SKILL_MARKET_ENDPOINT = endpoint
      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'skill-marketplace',
        order: 10,
        label: '技能市场',
      }, MarketplaceTab))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
