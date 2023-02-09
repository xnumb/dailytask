(function () {
  const vscode = acquireVsCodeApi()
  const COLORS = {
    'x': 'gray',
    'b': 'blue',
    'r': 'red',
    'o': 'orange',
    'g': 'green',
    'y': 'yellow',
  }
  let GlobalData = vscode.getState() || {
    list: [],
    active: ''
  }
  let timer = null

  init()

  function init() {
    window.addEventListener('message', e => {
      const msg = e.data
      switch(msg.type) {
        case 'insert':
          insert(msg.cmd)
          break
        case 'del':
          del(msg.id)
          break
        case 'edit': 
          edit(msg.id, msg.cmd)
          break
        case 'settime':
          setTime(msg.id, msg.val)
          break
        case 'sort':
          sort(msg.id, msg.val)
          break
        case 'clear':
          clear()
          break
        case 'reset':
          reset()
          break
      }
    })
    buildList(true)
    if (GlobalData.active) {
      startTimer()
    }
  }
  // main
  function buildList() {
    let html = ''
    for (let i in GlobalData.list) {
      let task = GlobalData.list[i]
      let actionHtml = ''
      let activeHtml = ''
      if (GlobalData.active == task.id) {
        actionHtml = `<div class="action action-pause" data-id="${task.id}">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-pause"></use>
            </svg>
          </div>`
        activeHtml = ' active'
      } else {
        if (task.sec >= task.duration*60) {
          actionHtml = `<div class="action action-done">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-check"></use>
            </svg>
          </div>`
        } else {
          actionHtml = `<div class="action action-play" data-id="${task.id}">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-play"></use>
            </svg>
          </div>`
        }
      }
      html += `<div class="item${activeHtml}">
        <div class="task">
          <div class="info">
            <div class="title">
              <span class="tag tag-${task.tag}">
                <svg class="icon" aria-hidden="true">
                  <use xlink:href="#icon-circle"></use>
                </svg>
              </span>
              ${task.title}
            </div>
            <div class="more">
              <div class="tm">
                <svg class="icon" aria-hidden="true">
                  <use xlink:href="#icon-time"></use>
                </svg>
                ${parseInt(task.sec/60)}/${task.duration}
              </div>
              <div class="btn btn-more" data-id="${task.id}">
                <svg class="icon" aria-hidden="true">
                  <use xlink:href="#icon-more"></use>
                </svg>
              </div>
            </div>
          </div>
          ${actionHtml}
        </div>
        <div class="progress" id="progress-${task.id}"></div>
      </div>`
    }
    if (html == '') {
      html = '<div class="msg">NO TASK</div>'
    }
    getDom('list').innerHTML = html
    if (GlobalData.list.length > 0) {
      getClass('btn-more').forEach(item => {
        item.addEventListener('click', _ => {
          let itemId = item.getAttribute('data-id')
          for(let i in GlobalData.list) {
            if (GlobalData.list[i].id == itemId) {
              vscode.postMessage({
                id: itemId,
                action: 'more',
                cmd: GlobalData.list[i].cmd
              })
              break
            }
          }
        })
      })
      getClass('action-pause').forEach(item => {
        item.addEventListener('click', _ => {
          clearInterval(timer)
          GlobalData.active = ''
          save()
        })
      })
      getClass('action-play').forEach(item => {
        item.addEventListener('click', _ => {
          let itemId = item.getAttribute('data-id')
          clearInterval(timer)
          GlobalData.active = itemId
          save()
          startTimer()
        })
      })
    }
    refreshProgress()
  }
  function refreshProgress() {
    let totalMin = 0
    let doneMin = 0
    GlobalData.list.forEach(item => {
      doneMin += item.sec*1
      totalMin += item.duration*1
      getDom('progress-' + item.id).innerHTML = buildProgress(parseInt(item.sec/60), item.duration*1)
    })
    doneMin = parseInt(doneMin/60)
    getDom('total-value').innerText = doneMin + '/' + totalMin + '(min)'
    getDom('total-progress').innerHTML = buildProgress(doneMin, totalMin)
  }
  function buildProgress(a, b) {
    let n = b == 0 ? 0 : parseInt((a / b) * 100)
    let html = ''
    for (let i = 0; i < 100; i++) {
      if (i < n) {
        html += '<div class="block_on"></div>'
      } else {
        html += '<div class="block_off"></div>'
      }
    }
    return html
  }
  function startTimer() {
    const sec = 5
    let loop = 0
    timer = setInterval(_ => {
      loop++
      if (GlobalData.active) {
        GlobalData.list.forEach(item => {
          if (item.id == GlobalData.active) {
            if (item.sec >= item.duration*60) {
              GlobalData.active = ''
              item.sec = item.duration*60
              save()
              alertMsg('Done: ' + item.title)
              clearInterval(timer)
            } else {
              item.sec += sec
              if (loop%12 == 0) {
                save()
              }
            }
          }
        })
      } else {
        clearInterval(timer)
      }
    }, sec*1000);
  }
  // action
  function insert(cmd) {
    if (GlobalData.list.length >= 16) {
      alertMsg('Warning: max task count', 'warn')
      return
    }
    let task = getCmdTask(cmd, 0)
    if (task.success) {
      GlobalData.list.push(task.content)
      save()
    } else {
      alertMsg(task.errMsg, 'warn')
    }
  }
  function del(id) {
    for (let i in GlobalData.list) {
      if (GlobalData.list[i].id == id) {
        GlobalData.list.splice(i, 1)
        save()
        break
      }
    }
  }
  function edit(id, cmd) {
    let task = getCmdTask(cmd, id)
    if (task.success) {
      for(let i in GlobalData.list) {
        if (GlobalData.list[i].id == id) {
          GlobalData.list[i] = task.content
          break
        }
      }
      save()
    } else {
      alertMsg(task.errMsg, 'warn')
    }
  }
  function setTime(id, min) {
    if (isNaN(min) || min <= 0) {
      alertMsg('Invalid Time Value', 'warn')
      return
    }
    for (let i in GlobalData.list) {
      if (GlobalData.list[i].id == id) {
        GlobalData.list[i].sec = min*60
        break
      }
    }
    save()
  }
  function sort(id, val) {
    for(let i in GlobalData.list) {
      if (GlobalData.list[i].id == id) {
        if (val == 1) {
          if (i == GlobalData.list.length-1) {
            alertMsg('Invalid Operation', 'warn')
            return
          }
          let item = GlobalData.list[i]
          GlobalData.list.splice(i, 1)
          GlobalData.list.splice(i+1, 0, item)
        } else {
          if (i == 0) {
            alertMsg('Invalid Operation', 'warn')
            return
          }
          let item = GlobalData.list[i]
          GlobalData.list.splice(i, 1)
          GlobalData.list.splice(i-1, 0, item)
        }
        save()
        break
      }
    }
  }
  function clear() {
    GlobalData = {
      list: [],
      active: ''
    }
    clearInterval(timer)
    save()
  }
  function reset() {
    for(let i in GlobalData.list) {
      GlobalData.list[i].sec = 0
    }
    GlobalData.active = ''
    clearInterval(timer)
    save()
  }
  // tool
  function save() {
    vscode.setState(GlobalData)
    buildList()
  }
  function getDom(id) {
    return document.querySelector('#' + id)
  }
  function getClass(id) {
    return document.querySelectorAll('.' + id)
  }
  function getCmdTask(cmd, id) {
    let cmds = cmd.split('#')
    if (cmds.length != 3) {
      return { success: false, errMsg: 'Invalid Format' }
    }
    if (!['r', 'g', 'o', 'b', 'y', 'x'].includes(cmds[0])) {
      return { success: false, errMsg: 'Color: x,b,r,g,o,y' }
    }
    let min = cmds[2] * 1
    if (isNaN(min) || min <= 0) {
      return { success: false, errMsg: 'Invalid Duration Value' }
    }
    return {
      success: true,
      content: {
        id: id == 0 ? genId() : id,
        cmd: cmd,
        tag: COLORS[cmds[0]],
        title: cmds[1],
        duration: min,
        sec: 0
      }
    }
  }
  function alertMsg(msg, type = 'info') {
    vscode.postMessage({
      action: 'alert',
      type: type,
      msg: msg
    })
  }
  function genId() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}())