const cards = document.querySelector('#cards')
const search = document.querySelector('#search')
const tagsEl = document.querySelector('#tags')
const statsEl = document.querySelector('#stats')
const dialog = document.querySelector('#detail')

let skills = []
let activeTag = ''
let selectedName = ''
let selectedEndpoint = window.location.origin

async function load() {
  try {
    const [skillsResponse, statsResponse] = await Promise.all([
      fetch('/api/v1/skills'),
      fetch('/api/v1/stats'),
    ])
    const skillsData = await skillsResponse.json()
    const stats = await statsResponse.json()
    skills = skillsData.skills ?? []
    renderTags()
    render()
    statsEl.textContent = `${stats.total} 个技能 · ${stats.downloads} 次安装 · ${stats.tags?.length ?? 0} 个标签`
  } catch (error) {
    cards.innerHTML = `<div class="empty">无法连接市场 API：${escapeHtml(String(error))}</div>`
    statsEl.textContent = 'API 离线'
  }
}

function renderTags() {
  const allTags = [...new Set(skills.flatMap((skill) => skill.tags ?? []))].sort()
  tagsEl.innerHTML = ''
  const reset = document.createElement('button')
  reset.className = `tag${activeTag ? '' : ' active'}`
  reset.textContent = '全部'
  reset.onclick = () => { activeTag = ''; renderTags(); render() }
  tagsEl.appendChild(reset)
  for (const tag of allTags) {
    const button = document.createElement('button')
    button.className = `tag${tag === activeTag ? ' active' : ''}`
    button.textContent = tag
    button.onclick = () => { activeTag = activeTag === tag ? '' : tag; renderTags(); render() }
    tagsEl.appendChild(button)
  }
}

function render() {
  const query = search.value.trim().toLowerCase()
  const filtered = skills.filter((skill) => {
    if (activeTag && !(skill.tags ?? []).includes(activeTag)) return false
    if (!query) return true
    return [skill.name, skill.description, skill.whenToUse ?? '', ...(skill.tags ?? [])]
      .join(' ').toLowerCase().includes(query)
  })
  if (filtered.length === 0) {
    cards.innerHTML = '<div class="empty">没有匹配的技能</div>'
    return
  }
  cards.innerHTML = filtered.map((skill) => `
    <article class="card" data-name="${escapeHtml(skill.name)}">
      <h3>${escapeHtml(skill.name)}</h3>
      <p>${escapeHtml(skill.description)}</p>
      <div class="badges">
        <span class="badge">v${escapeHtml(skill.version)}</span>
        <span class="badge">${skill.downloads} 次安装</span>
        <span class="badge">${escapeHtml(skill.author)}</span>
        ${skill.invocation?.modelInvocable === false ? '<span class="badge off">仅用户</span>' : '<span class="badge on">模型可调用</span>'}
      </div>
    </article>`).join('')
  cards.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.name))
  })
}

async function openDetail(name) {
  selectedName = name
  selectedEndpoint = window.location.origin
  dialog.showModal()
  const meta = document.querySelector('#detail-meta')
  const nameEl = document.querySelector('#detail-name')
  const descEl = document.querySelector('#detail-description')
  nameEl.textContent = name
  descEl.textContent = '加载中…'
  meta.innerHTML = ''
  showInstall('cli')
  try {
    const [skillResponse, contentResponse] = await Promise.all([
      fetch(`/api/v1/skills/${encodeURIComponent(name)}`),
      fetch(`/api/v1/skills/${encodeURIComponent(name)}/content`),
    ])
    const skill = await skillResponse.json()
    if (skillResponse.status !== 200) throw new Error(skill.error ?? '加载失败')
    nameEl.textContent = skill.name
    descEl.textContent = skill.description
    meta.innerHTML = `
      <span class="badge">v${escapeHtml(skill.version)}</span>
      <span class="badge">${escapeHtml(skill.author)}</span>
      <span class="badge">${escapeHtml(skill.license)}</span>
      <span class="badge">${skill.downloads} 次安装</span>
      <span class="badge">${skill.invocation?.modelInvocable === false ? '模型不可调用' : '模型可调用'}</span>
      <span class="badge">${skill.invocation?.userInvocable === false ? '用户不可调用' : '用户可调用'}</span>
    `
    if (skill.whenToUse) {
      meta.insertAdjacentHTML('beforeend', `<span class="badge">何时使用：${escapeHtml(skill.whenToUse)}</span>`)
    }
    document.querySelector('#detail-content').textContent = await contentResponse.text()
  } catch (error) {
    descEl.textContent = '加载失败'
    document.querySelector('#detail-content').textContent = error.message
  }
}

function showInstall(tab) {
  document.querySelectorAll('#install-tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab)
  })
  const code = document.querySelector('#detail-install')
  if (tab === 'cli') {
    code.textContent = `# 安装到用户级技能目录（所有项目可用）\ndsh-market install ${selectedName}\n\n# 或安装到当前项目（提交给团队共享）\ndsh-market install ${selectedName} --target project`
  } else if (tab === 'remote') {
    code.textContent = `# 1) 把远程 provider 插件加入你的 profile\ndsh plugin --profile web add @dsh-skill-market/dsh-skill-marketplace\n\n# 2) 在该 profile 的 cordis.patch.yml 中追加：\n- insert:\n    - id: skill-marketplace\n      name: '@dsh-skill-market/dsh-skill-marketplace'\n      config:\n        endpoint: ${selectedEndpoint}\n\n# 3) 重启后，市场技能会直接出现在 dsh 会话的 <available_skills> 目录中`
  } else {
    code.textContent = `# DSH 会自动发现以下目录中的技能（一级目录/SKILL.md）\nmkdir -p ~/.dsh/skills/${selectedName}\n\n# 下载 SKILL.md 和 assets/ 到该目录，然后重启会话即可`
  }
}

document.querySelector('#close-detail').onclick = () => dialog.close()
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})
document.querySelector('#install-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('button')?.dataset.tab
  if (tab) showInstall(tab)
})

search.addEventListener('input', render)

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

load()
