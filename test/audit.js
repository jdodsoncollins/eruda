describe('audit', function () {
  let tool
  let $tool
  let fixture

  beforeAll(function () {
    fixture = document.createElement('div')
    fixture.innerHTML = '<img id="audit-test-img"><button id="audit-test-button"></button>'
    document.body.appendChild(fixture)

    eruda.add(new eruda.Audit())
    tool = eruda.get('audit')
    $tool = $('.eruda-audit')
  })

  afterAll(function () {
    if (eruda.get('audit')) eruda.remove('audit')
    document.body.removeChild(fixture)
  })

  it('init', function () {
    expect(eruda.Audit).toBeDefined()
    expect(tool).toBeDefined()
    expect($tool).toContainText('Accessibility')
    expect($tool.find('.eruda-result')).toHaveLength(tool._tests.length)
  })

  it('add custom check', function () {
    tool.add('Plugin', {
      name: 'Custom plugin check',
      desc: 'Added using the plugin-style API',
      run: function () {
        return true
      },
    })

    expect($tool.find('.eruda-result')).toHaveLength(tool._tests.length)
    expect($tool).toContainText('Custom plugin check')
  })

  it('run', function (done) {
    tool.run().then(function (results) {
      let imageResult = results.find(function (result) {
        return result.name === 'Images have text alternatives'
      })
      let buttonResult = results.find(function (result) {
        return result.name === 'Interactive elements have text'
      })

      expect(results.length).toBe(tool._tests.length)
      expect(imageResult.level).toBe('fail')
      expect(imageResult.nodes).toContain(fixture.querySelector('img'))
      expect(buttonResult.level).toBe('fail')
      expect($tool.find('.eruda-fail').length).toBeGreaterThan(0)
      expect(results.find(function (result) {
        return result.name === 'Custom plugin check'
      }).level).toBe('pass')
      done()
    })
  })

  it('export', function () {
    let data = tool.export()

    expect(data.type).toBe('audit-result')
    expect(data.url).toBe(location.href)
    expect(data.results.length).toBe(tool._tests.length)
  })

  it('export safari', function () {
    let data = tool.exportSafari()

    expect(data.type).toBe('test-group')
    expect(data.name).toBe('Eruda Audit')
    expect(data.tests.length).toBeGreaterThan(0)
  })

  it('remove plugin', function () {
    eruda.remove('audit')

    expect(eruda.get('audit')).not.toBeDefined()
    expect($('.eruda-audit')).toHaveLength(0)
  })
})
