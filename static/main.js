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
        case 'updateTimer':
          updateTimer()
          break
        case 'add':
          add(msg.cmd)
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
    build()
  }
  function updateTimer() {
    if (GlobalData.active) {
      GlobalData.list.forEach(item => {
        if (item.id == GlobalData.active) {
          let s = parseInt((new Date()).getTime() / 1000)
          item.sec += s - item.ts
          item.ts = s
        }
      })
      save()
    }
  }
  // build
  function taskAction(idx, action) {
    let task = GlobalData.list[idx]
    if (action == 'more') {
      vscode.postMessage({
        id: task.id,
        action: 'more',
        cmd: task.cmd
      })
    } else if (action == 'play') {
      GlobalData.active = task.id
      task.ts = parseInt((new Date()).getTime() / 1000)
      save()
    } else if (action == 'pause') {
      GlobalData.active = ''
      save()
    }
  }
  function build() {
    let html = ''
    let taskList = GlobalData.list
    taskList.forEach( task => {
      let actionHtml = ''
      let activeHtml = ''
      if (GlobalData.active == task.id) {
        actionHtml = `<div class="action btn" data-action="pause" data-id="${task.id}">
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
          actionHtml = `<div class="action btn" data-action="play" data-id="${task.id}">
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
              <div class="btn" data-action="more" data-id="${task.id}">
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
    })
    if (html == '') {
      html = '<div class="msg">NO TASK</div>'
    }
    getDom('list').innerHTML = html
    if (taskList.length > 0) {
      getClass('btn').forEach(item => {
        item.addEventListener('click', _ => {
          for (let i in taskList) {
            if (taskList[i].id == item.getAttribute('data-id')) {
              taskAction(i, item.getAttribute('data-action'))
              break
            }
          }
        })
      })
    }
    updateProgress()
  }
  function updateProgress() {
    let totalMin = 0
    let doneMin = 0
    GlobalData.list.forEach(item => {
      doneMin += item.sec*1
      totalMin += item.duration*1
      if (item.id == GlobalData.active && item.sec >= item.duration * 60) {
        GlobalData.active = ''
        item.sec = item.duration * 60
        alertMsg('Done: ' + item.title)
        save()
        return
      }
      getDom('progress-' + item.id).innerHTML = buildProgress(parseInt(item.sec/60), item.duration*1)
    })
    doneMin = parseInt(doneMin/60)
    getDom('total-value').innerText = doneMin + '/' + totalMin + '(min)'
    getDom('total-progress').innerHTML = buildProgress(doneMin, totalMin)
  }
  function buildProgress(a, b) {
    let n = (a == 0 || b == 0) ? 0 : parseInt(a*100 / b)
    n = n > 100 ? 100 : n
    let html = ''
    if (n == 0) {
      html = '<div class="flex-1"></div>'
    } else if (n == 100) {
      html = '<div class="block_on flex-1"></div>'
    } else {
      html = `<div class="block_on flex-${n}"></div>`
      html += `<div class="flex-${100-n}"></div>`
    }
    return html
  }
  // action
  function add(cmd) {
    if (GlobalData.list.length >= 16) {
      alertMsg('Warning: max task count', 'warn')
      return
    }
    let task = parseCmd(cmd, 0)
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
    let task = parseCmd(cmd, id)
    if (task.success) {
      for(let i in GlobalData.list) {
        if (GlobalData.list[i].id == id) {
          task.content.sec = GlobalData.list[i].sec
          GlobalData.list[i] = task.content
          save()
          return
        }
      }
    } else {
      alertMsg(task.errMsg, 'warn')
    }
  }
  function setTime(id, min) {
    if (isNaN(min) || min <= 0) {
      alertMsg('Invalid Time Value', 'warn')
      return
    }
    let taskList = GlobalData.list
    for (let i in taskList) {
      if (taskList[i].id == id) {
        taskList[i].sec = min > taskList[i].duration ? taskList[i].duration*60 : min*60
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
    save()
  }
  function reset() {
    for(let i in GlobalData.list) {
      GlobalData.list[i].sec = 0
    }
    GlobalData.active = ''
    save()
  }
  // tool
  function save() {
    vscode.setState(GlobalData)
    build()
  }
  function getDom(id) {
    return document.querySelector('#' + id)
  }
  function getClass(id) {
    return document.querySelectorAll('.' + id)
  }
  function parseCmd(cmd, id) {
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
        sec: 0,
        ts: 0,
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