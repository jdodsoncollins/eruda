import Tool from '../DevTools/Tool'
import copy from 'licia/copy'
import each from 'licia/each'
import escape from 'licia/escape'
import map from 'licia/map'
import evalCss from '../lib/evalCss'
import { classPrefix as c, isErudaEl } from '../lib/util'

const LEVELS = ['fail', 'warning', 'unsupported', 'pass']

export default class Audit extends Tool {
  constructor() {
    super()

    this._style = evalCss(require('./Audit.scss'))

    this.name = 'audit'
    this._tests = defTests()
    this._results = []
  }
  init($el, container) {
    super.init($el)
    this._container = container

    this._initTpl()
    this._bindEvent()
    this._render()
  }
  destroy() {
    super.destroy()

    evalCss.remove(this._style)
  }
  add(group, test) {
    this._tests.push({ group, ...test })

    this._render()

    return this
  }
  clear() {
    this._results = []

    this._render()

    return this
  }
  results() {
    return this._results.slice()
  }
  run() {
    const results = []
    let promise = Promise.resolve()

    each(this._tests, (test) => {
      promise = promise.then(() => runTest(test)).then((result) => {
        results.push(result)
        this._results = results
        this._render()
      })
    })

    return promise.then(() => {
      this._container.notify('Audit complete', { icon: 'success' })
      return results
    })
  }
  export() {
    return {
      type: 'audit-result',
      url: location.href,
      date: new Date().toISOString(),
      results: map(this._results, serializeResult),
    }
  }
  exportSafari() {
    const groups = {}
    each(this._tests, (test) => {
      const group = (groups[test.group] = groups[test.group] || [])
      group.push({
        type: 'test-case',
        name: test.name,
        description: test.desc,
        test: test.safariTest || 'function() { return "unsupported" }',
      })
    })

    return {
      type: 'test-group',
      name: 'Eruda Audit',
      tests: map(groups, (tests, name) => ({
        type: 'test-group',
        name,
        tests,
      })),
    }
  }
  _initTpl() {
    this._$el.html(
      c(`<div class="control">
        <span class="icon-play run-audit"></span>
        <span class="icon-clear clear-audit"></span>
        <span class="icon-copy copy-results"></span>
        <span class="summary">Not run</span>
      </div>
      <div class="results"></div>`)
    )

    this._$summary = this._$el.find(c('.summary'))
    this._$results = this._$el.find(c('.results'))
  }
  _bindEvent() {
    const self = this

    this._$el
      .on('click', c('.run-audit'), () => this.run())
      .on('click', c('.clear-audit'), () => this.clear())
      .on('click', c('.copy-results'), () => {
        copy(JSON.stringify(this.export(), null, 2))
        this._container.notify('Copied', { icon: 'success' })
      })
      .on('click', c('.node'), function () {
        const node = this.auditNode
        const elements = self._container.get('elements')
        if (node && elements) {
          elements.select(node)
          self._container.showTool('elements')
        }
      })
  }
  _render() {
    if (this._results.length === 0) {
      this._$summary.text(`${this._tests.length} checks`)
      this._$results.html(renderGroups(this._tests))
      return
    }

    const counts = countLevels(this._results)
    this._$summary.text(
      `${counts.pass} passed, ${counts.warning} warnings, ${counts.fail} failed, ${counts.unsupported} unsupported`
    )

    this._$results.html(renderGroups(this._results))

    const nodeEls = this._$results.find(c('.node'))
    let idx = 0
    each(this._results, (result) => {
      each(result.nodes || [], (node) => {
        nodeEls.get(idx++).auditNode = node
      })
    })
  }
}

function serializeResult(result) {
  return {
    group: result.group,
    name: result.name,
    desc: result.desc,
    level: result.level,
    message: result.message,
    details: result.details,
    nodes: map(result.nodes || [], nodeName),
  }
}

function runTest(test) {
  return Promise.resolve()
    .then(() => test.run())
    .then((result) => normalizeResult(test, result))
    .catch((err) => ({
      group: test.group,
      name: test.name,
      desc: test.desc,
      level: 'error',
      message: err.message,
      details: [],
      nodes: [],
    }))
}

function normalizeResult(test, result) {
  if (result === true) result = { level: 'pass' }
  if (result === false) result = { level: 'fail' }
  if (typeof result === 'string') result = { level: result }
  result = result || {}

  return {
    group: test.group,
    name: test.name,
    desc: test.desc,
    level: result.level || 'pass',
    message: result.message || '',
    details: result.details || [],
    nodes: result.nodes || [],
  }
}

function renderGroups(items) {
  const groups = {}
  each(items, (item) => {
    const group = (groups[item.group] = groups[item.group] || [])
    group.push(item)
  })

  return map(groups, (items, group) => {
    return `<section class="${c('group')}">
      <h2>${escape(group)}</h2>
      ${map(items, renderItem).join('')}
    </section>`
  }).join('')
}

function renderItem(item) {
  const level = item.level || 'pending'
  const message = item.message ? `<p>${escape(item.message)}</p>` : ''
  const itemDetails = item.details || []
  const itemNodes = item.nodes || []
  const details = itemDetails.length
    ? `<ul>${map(itemDetails, (detail) => `<li>${escape(detail)}</li>`).join('')}</ul>`
    : ''
  const nodes = itemNodes.length
    ? `<div>${map(itemNodes, (node) => {
        return `<button class="${c('node')}">${escape(nodeName(node))}</button>`
      }).join('')}</div>`
    : ''

  return `<div class="${c(`result ${level}`)}">
    <h3><span>${escape(level)}</span>${escape(item.name)}</h3>
    ${message}
    ${details}
    ${nodes}
  </div>`
}

function countLevels(results) {
  const ret = {}
  each(LEVELS, (level) => (ret[level] = 0))
  each(results, (result) => {
    if (ret[result.level] == null) ret[result.level] = 0
    ret[result.level]++
  })
  return ret
}

function nodeName(node) {
  if (!node) return ''
  if (node.id) return `${node.tagName.toLowerCase()}#${node.id}`
  if (node.className && typeof node.className === 'string') {
    return `${node.tagName.toLowerCase()}.${node.className.split(/\s+/)[0]}`
  }
  return node.tagName ? node.tagName.toLowerCase() : String(node)
}

function defTests() {
  return [
    {
      group: 'Accessibility',
      name: 'Images have text alternatives',
      desc: 'Checks images for alt, title, aria-label, or aria-labelledby.',
      run() {
        const nodes = filterNodes(document.images, (img) => {
          return !hasTextAttr(img, ['alt', 'title', 'aria-label', 'aria-labelledby'])
        })
        return resultForNodes(nodes, 'Images without text alternatives')
      },
    },
    {
      group: 'Accessibility',
      name: 'Controls have labels',
      desc: 'Checks common form controls for labels or accessible names.',
      run() {
        const controls = document.querySelectorAll('input, select, textarea')
        const nodes = filterNodes(controls, (el) => {
          if (el.type === 'hidden') return false
          return !hasLabel(el)
        })
        return resultForNodes(nodes, 'Controls without labels')
      },
    },
    {
      group: 'Accessibility',
      name: 'Interactive elements have text',
      desc: 'Checks links and buttons for visible text or accessible names.',
      run() {
        const nodes = filterNodes(document.querySelectorAll('a, button'), (el) => {
          return !hasText(el) && !hasTextAttr(el, ['title', 'aria-label', 'aria-labelledby'])
        })
        return resultForNodes(nodes, 'Interactive elements without text')
      },
    },
    {
      group: 'Accessibility',
      name: 'ARIA references resolve',
      desc: 'Checks aria-labelledby and aria-describedby references.',
      run() {
        const nodes = filterNodes(
          document.querySelectorAll('[aria-labelledby], [aria-describedby]'),
          (el) => !refsExist(el, 'aria-labelledby') || !refsExist(el, 'aria-describedby')
        )
        return resultForNodes(nodes, 'Elements with broken ARIA references')
      },
    },
    {
      group: 'Accessibility',
      name: 'IDs are unique',
      desc: 'Checks for duplicate id attributes.',
      run() {
        const seen = {}
        const nodes = filterNodes(document.querySelectorAll('[id]'), (el) => {
          const duplicate = seen[el.id]
          seen[el.id] = true
          return duplicate
        })
        return resultForNodes(nodes, 'Elements with duplicate ids')
      },
    },
    {
      group: 'Best Practices',
      name: 'Viewport is mobile friendly',
      desc: 'Checks for viewport metadata that preserves zoom.',
      run() {
        const viewport = document.querySelector('meta[name="viewport"]')
        if (!viewport) return { level: 'fail', message: 'Missing viewport meta tag' }

        const content = viewport.getAttribute('content') || ''
        if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?(?:\D|$)/i.test(content)) {
          return {
            level: 'warning',
            message: 'Viewport disables or restricts zoom',
            nodes: [viewport],
          }
        }
        return { level: 'pass' }
      },
    },
    {
      group: 'Best Practices',
      name: 'External links are isolated',
      desc: 'Checks target=_blank links for rel=noopener or noreferrer.',
      run() {
        const nodes = filterNodes(document.querySelectorAll('a[target="_blank"]'), (el) => {
          const rel = el.getAttribute('rel') || ''
          return !/\bnoopener\b|\bnoreferrer\b/i.test(rel)
        })
        return resultForNodes(nodes, 'target=_blank links without rel=noopener')
      },
    },
    {
      group: 'Performance',
      name: 'DOM size is reasonable',
      desc: 'Warns when the page has many DOM nodes.',
      run() {
        const count = document.getElementsByTagName('*').length
        if (count > 1500) {
          return { level: 'warning', message: `${count} DOM nodes found` }
        }
        return { level: 'pass', message: `${count} DOM nodes found` }
      },
    },
    {
      group: 'Performance',
      name: 'Resource timing is available',
      desc: 'Summarizes loaded resources when PerformanceResourceTiming is available.',
      run() {
        if (!(performance && performance.getEntriesByType)) {
          return { level: 'unsupported', message: 'PerformanceResourceTiming is unavailable' }
        }
        const entries = performance.getEntriesByType('resource')
        const total = Math.round(sum(entries, 'transferSize') / 1024)
        return {
          level: 'pass',
          message: `${entries.length} resources, ${total} KiB transferred`,
        }
      },
    },
    {
      group: 'Eruda',
      name: 'Eruda container is isolated',
      desc: 'Checks that Eruda is mounted in the expected container.',
      run() {
        const el = document.getElementById('eruda')
        if (!el) return { level: 'fail', message: 'Missing #eruda container' }
        return { level: 'pass', nodes: [el] }
      },
    },
  ]
}

function resultForNodes(nodes, message) {
  return {
    level: nodes.length ? 'fail' : 'pass',
    message: nodes.length ? `${message}: ${nodes.length}` : '',
    nodes,
  }
}

function filterNodes(nodes, fn) {
  const ret = []
  each(nodes, (node) => {
    if (!isErudaEl(node) && fn(node)) ret.push(node)
  })
  return ret
}

function hasText(el) {
  return !!(el.textContent && el.textContent.trim())
}

function hasTextAttr(el, attrs) {
  for (let i = 0, len = attrs.length; i < len; i++) {
    const val = el.getAttribute(attrs[i])
    if (val && val.trim()) return true
  }
  return false
}

function hasLabel(el) {
  if (hasTextAttr(el, ['title', 'aria-label', 'aria-labelledby'])) return true
  if (el.id && document.querySelector(`label[for="${cssEscape(el.id)}"]`)) return true
  return !!closest(el, 'label')
}

function refsExist(el, attr) {
  const val = el.getAttribute(attr)
  if (!val) return true
  const ids = val.trim().split(/\s+/)
  for (let i = 0, len = ids.length; i < len; i++) {
    if (!document.getElementById(ids[i])) return false
  }
  return true
}

function closest(el, selector) {
  while (el && el !== document) {
    if (el.matches && el.matches(selector)) return el
    el = el.parentNode
  }
}

function sum(arr, key) {
  let ret = 0
  each(arr, (item) => (ret += item[key] || 0))
  return ret
}

function cssEscape(str) {
  if (window.CSS && CSS.escape) return CSS.escape(str)
  return str.replace(/"/g, '\\"')
}
