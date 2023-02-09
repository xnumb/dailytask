(function () {
  const vscode = acquireVsCodeApi()
  const ENUM = {
    maxCount: 32,
    loopTs: 60000,
    minTs: 60000,
    colors: {
      'x': 'gray',
      'b': 'blue',
      'r': 'red',
      'o': 'orange',
      'g': 'green',
      'y': 'yellow',
    },
    state: {
      disabled: 0,
      wait: 1,
      play: 2,
      done: 3,
    },
    activeState: {
      none: 0,
      play: 1,
      pause: 2,
    },
    active: {
      task: null,
      state: 0, // activeState.none
      startTime: '', // 开始时间
      startTs: 0, // 开始时间戳
      pauseTs: 0, // 上一次暂停时间戳
      pauseSd: 0, // 暂停毫秒秒数
    }
  }
  const oldState = vscode.getState() || {
    data: [],
    active: JSON.parse(JSON.stringify(ENUM.active)),
  }

  let timer = null
  let data = oldState.data
  let active = oldState.active

  init()

  // main func
  function init() {
    window.addEventListener('message', event => {
      const message = event.data
      switch (message.type) {
        case 'insert':
          insert(message.cmd)
          break
        case 'editTask':
          editTaskSubmit(message.id, message.cmd)
          break
        case 'clear':
          clear()
          break
        case 'reset':
          reset()
          break
        case 'delTaskSubmit':
          delTaskSubmit(message.id)
          break
      }
    })
    buildNow()
    buildList()
    updateProgress()
    startTimer()
  }

  function startTimer() {
    if (active.state == ENUM.activeState.play) {
      timer = setInterval(() => {
        updateProgress()
      }, ENUM.loopTs)
    }
  }

  //  build func
  function buildNow() {
    let html = '<div class="msg">暂无进行中任务</div>'
    if (active.state != ENUM.activeState.none) {
      let action = active.state == ENUM.activeState.play ? 'pause' : 'play'
      let runMin = getRunMin()
      html = `<div class="task">
        <div class="info">
          <div class="name">
            <span class="tag tag-${active.task.tag}">
              <svg class="icon" aria-hidden="true">
                <use xlink:href="#icon-circle"></use>
              </svg>
            </span>
            ${active.task.name}
          </div>
          <div class="more">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-start"></use>
            </svg>
            ${active.startTime}
            &nbsp;&nbsp;
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-countdown"></use>
            </svg>
            <span id="run-value">${runMin}</span>/${active.task.time}
          </div>
        </div>
        <div class="action" id="btn-run">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-${action}"></use>
          </svg>
        </div>
      </div>`
    }
    getRoot('now').innerHTML = html
    let runBtn = getRoot('btn-run')
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        runTask()
      })
    }
  }
  function buildList() {
    let html = ''
    for (let i in data) {
      let task = data[i]
      let noneBtn = `<div class="it">&nbsp;</div>`
      let sortupBtn = `<div class="it btn-sort" data-id="${task.id}" data-d="up">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-up"></use>
        </svg>
      </div>`
      let sortdownBtn = `<div class="it btn-sort" data-id="${task.id}" data-d="down">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-down"></use>
        </svg>
      </div>`
      let removeBtn = `<div class="it btn-remove" data-id="${task.id}">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-remove"></use>
        </svg>
      </div>`
      let editBtn = `<div class="it btn-edit" data-id="${task.id}">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-edit"></use>
        </svg>
      </div>`
      let disabledBtn = `<div class="it btn-disabled" data-id="${task.id}">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-disabled"></use>
        </svg>
      </div>`
      let playBtn = `<div class="it btn-play" data-id="${task.id}">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-play"></use>
        </svg>
      </div>`
      let state = ''
      let tagIcon = ''
      let btnsHtml = sortupBtn + sortdownBtn
      if (i == 0) {
        btnsHtml = noneBtn + sortdownBtn
      }
      if (i == data.length-1) {
        btnsHtml = sortupBtn + noneBtn
      }
      if (task.state == ENUM.state.disabled) {
        state = 'disabled'
        tagIcon = 'circle'
        btnsHtml += removeBtn + editBtn + disabledBtn + noneBtn
      } else if (task.state == ENUM.state.wait) {
        state = 'wait'
        tagIcon = 'circle'
        btnsHtml += removeBtn + editBtn + disabledBtn + playBtn
      } else if (task.state == ENUM.state.play) {
        state = 'play'
        tagIcon = 'countdown'
        btnsHtml += noneBtn + noneBtn + noneBtn + noneBtn
      } else if (task.state == ENUM.state.done) {
        state = 'done'
        tagIcon = 'check'
        btnsHtml += removeBtn + editBtn + disabledBtn + noneBtn
      }
      html += `<div class="task task-${state}">
        <div class="info btn-toggle">
          <div class="name">
            <div class="name-wp">
              <span class="tag tag-${task.tag}">
                <svg class="icon" aria-hidden="true">
                  <use xlink:href="#icon-${tagIcon}"></use>
                </svg>
              </span>
              ${task.name}
            </div>
          </div>
          <div class="tm">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-time"></use>
            </svg>
            ${task.time}
          </div>
          <div class="more">
            <svg class="icon icon-down" aria-hidden="true">
              <use xlink:href="#icon-down"></use>
            </svg>
            <svg class="icon icon-up" aria-hidden="true">
              <use xlink:href="#icon-up"></use>
            </svg>
          </div>
        </div>
        <div class="action">${btnsHtml}</div>
      </div>`
    }
    getRoot('list').innerHTML = html
    getBtns('toggle').forEach(item => {
      item.addEventListener('click', () => {
        let c = item.parentNode
        let cs = c.parentNode.children
        for (let i=0; i<cs.length; i++) {
          if (cs[i] == c) {
            if (c.classList.length == 2) {
              c.classList.add('active')
            } else {
              c.classList.remove('active')
            }
          } else {
            if (cs[i].classList.length == 3) {
              cs[i].classList.remove('active')
            }
          }
        }
        
      })
    })
    getBtns('play').forEach(item => {
      item.addEventListener('click', () => {
        playTask(getAttr(item, 'id'))
      })
    })
    getBtns('remove').forEach(item => {
      item.addEventListener('click', () => {
        delTask(getAttr(item, 'id'))
      })
    })
    getBtns('edit').forEach(item => {
      item.addEventListener('click', () => {
        editTask(getAttr(item, 'id'))
      })
    })
    getBtns('sort').forEach(item => {
      item.addEventListener('click', () => {
        sortTask(getAttr(item, 'id'), getAttr(item, 'd'))
      })
    })
    getBtns('disabled').forEach(item => {
      item.addEventListener('click', () => {
        disableTask(getAttr(item, 'id'))
      })
    })
  }
  function buildProgress(a, b) {
    let n = b == 0 ? 0 : parseInt((a/b)*100)
    let html = ''
    for (let i = 0; i<100; i++) {
      if (i<n) {
        html += '<div class="block_on"></div>'
      } else {
        html += '<div class="block_off"></div>'
      }
    }
    return html
  }
  function updateProgress() {
    let runMin = getRunMin()
    if (active.state != ENUM.activeState.none && runMin >= active.task.time) {
      doneTask()
      return
    }
    let totalMin = 0
    let doneMin = runMin*1
    for (let i in data) {
      if (data[i].state != ENUM.state.disabled) {
        if (data[i].state == ENUM.state.done) {
          doneMin += data[i].time*1
        }
        totalMin += data[i].time*1
      }
    }
    getRoot('total-value').innerText = doneMin+'/'+totalMin+'(min)'
    getRoot('total-progress').innerHTML = buildProgress(doneMin, totalMin)
    if (active.state == ENUM.activeState.none) {
      getRoot('now-progress').innerHTML = buildProgress(0, 100)
    } else {
      getRoot('run-value').innerText = runMin + ''
      getRoot('now-progress').innerHTML = buildProgress(runMin, active.task.time)
    }
  }

  // action func
  function runTask() {
    if (active.state == ENUM.activeState.play) {
      active.state = ENUM.activeState.pause
      active.pauseTs = (new Date).getTime()
      clearInterval(timer)
    } else {
      active.state = ENUM.activeState.play
      active.pauseSd = active.pauseSd*1 + ((new Date).getTime() - active.pauseTs)
      startTimer()
    }
    save()
    buildNow()
  }
  function insert(cmd) {
    if (data.length >= ENUM.maxCount) {
      alertMsg('最多添加'+ENUM.maxCount+'个任务', 'warning')
      return
    }
    let res = getCmdTask(cmd, 0)
    if (res.success) {
      data.push(res.newTask)
      save()
      buildList()
      updateProgress()
    } else {
      alertMsg(res.errMsg, 'warning')
    }
  }
  function playTask(id) {
    for (let i in data) {
      if (data[i].state == ENUM.state.play) {
        data[i].state = ENUM.state.wait
      }
      if (data[i].id == id) {
        data[i].state = ENUM.state.play
        active.task = data[i]
        active.state = ENUM.activeState.play
        let t = new Date()
        active.startTime = getTimeStr(t)
        active.startTs = t.getTime()
        active.pauseTs = 0
        active.pauseSd = 0
      }
    }
    save()
    buildNow()
    buildList()
    updateProgress()
    startTimer()
  }
  function delTask(id) {
    postAction('del', id)
  }
  function delTaskSubmit(id) {
    for (let i in data) {
      if (data[i].id == id) {
        data.splice(i, 1)
        save()
        buildList()
        updateProgress()
        break
      }
    }
  }
  function disableTask(id) {
    for (let i in data) {
      if (data[i].id == id) {
        data[i].state = data[i].state == ENUM.state.disabled ? ENUM.state.wait : ENUM.state.disabled
        save()
        buildList()
        updateProgress()
        break
      }
    }
  }
  function sortTask(id, d) {
    for (let i in data) {
      if (data[i].id == id) {
        let offset = d == 'up' ? -1 : 1
        let newIdx = offset*1 + i*1
        if (newIdx < 0 || newIdx >=data.length) {
          return
        }
        data = swapArr(data, i, newIdx)
        save()
        buildList()
        break
      }
    }
  }
  function editTask(id) {
    postAction('edit', id)
  }
  function editTaskSubmit(id, cmd) {
    let res = getCmdTask(cmd, id)
    if (res.success) {
      for (let i in data) {
        if (data[i].id == id) {
          data[i] = res.newTask
          break
        }
      }
      save()
      buildList()
      updateProgress()
    } else {
      alertMsg(res.errMsg, 'warning')
    }
  }
  function doneTask() {
    for (let i in data) {
      if (data[i].id == active.task.id) {
        data[i].state = ENUM.state.done
        active = JSON.parse(JSON.stringify(ENUM.active))
        save()
        clearInterval(timer)
        buildNow()
        buildList()
        updateProgress()
        alertMsg('任务完成：'+data[i].name)
        return
      }
    }
  }
  function clear() {
    data = []
    active = JSON.parse(JSON.stringify(ENUM.active))
    save()
    clearInterval(timer)
    buildNow()
    buildList()
    updateProgress()
  }
  function reset() {
    for(let i in data) {
      if (data[i].state != ENUM.state.disabled) {
        data[i].state = ENUM.state.wait
      }
    }
    active = JSON.parse(JSON.stringify(ENUM.active))
    save()
    clearInterval(timer)
    buildNow()
    buildList()
    updateProgress()
  }

  // Tool func
  function save() {
    vscode.setState({ 
      data: data,
      active: active
    })    
  }
  function getBtns(id) {
    return document.querySelectorAll('.btn-'+id)
  }
  function getRoot(id) {
    return document.querySelector('#'+id)
  }
  function getAttr(obj, attr) {
    return obj.getAttribute('data-'+attr)
  }
  function getCmdTask(cmd, id) {
    let cmds = cmd.split('#')
    if (cmds.length != 3) {
      return { success: false, errMsg: '添加任务命令格式不正确'}
    }
    if (!['r', 'g', 'o', 'b', 'y', 'x'].includes(cmds[0])) {
      return { success: false, errMsg: '标签颜色为：x,b,r,g,o,y'}
    }
    let min = cmds[2]*1
    if (isNaN(min) || min <= 0) {
      return { success: false, errMsg: '分钟数为正整数'}
    }
    if (min > 180) {
      return { success: false, errMsg: '任务时间最大为180分钟'}
    }
    return {
      success: true,
      newTask: {
        id: id == 0 ? getID() : id,
        tag: ENUM.colors[cmds[0]],
        name: cmds[1],
        time: min,
        state: ENUM.state.wait,
      }
    }
  }
  function getRunMin() {
    if (active.state == ENUM.activeState.none) {
      return 0
    } else {
      let t = (new Date()).getTime()
      if (active.state == ENUM.activeState.play) {
        return parseInt((t - active.startTs - active.pauseSd)/ENUM.minTs)
      } else { // 暂停状态获取时间
        return parseInt((active.pauseTs-active.startTs-active.pauseSd)/ENUM.minTs)
      }
    }
  }
  function getID() {
    let ids = []
    for (let i in data) {
      ids.push(data[i].id)
    }
    for (let i=1; i<=ENUM.maxCount+10; i++) {
      if (!ids.includes(i)) {
        return i
      }
    }
  }
  function getTimeStr(t) {
    let h = t.getHours() + ''
    let m = t.getMinutes() + ''
    h = h.length == 1 ? '0'+ h : h
    m = m.length == 1 ? '0'+ m : m
    return h + ':'+ m
  }
  function alertMsg(msg, type='info') {
    vscode.postMessage({
      action: 'alert',
      type: type,
      content: msg
    })
  }
  function postAction(action, id) {
    vscode.postMessage({
      action: action,
      id: id
    })
  }
  function swapArr(arr, index1, index2) {
    arr[index1] = arr.splice(index2, 1, arr[index1])[0]
    return arr
  }
}())