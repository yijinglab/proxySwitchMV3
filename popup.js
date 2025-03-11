document.addEventListener('DOMContentLoaded', () => {
  // 获取代理配置列表并初始化界面
  loadProxyConfigs();
  
  // 代理选项点击事件（直接连接和系统代理）
  document.querySelectorAll('.proxy-option').forEach(button => {
    button.addEventListener('click', (e) => {
      const mode = e.target.dataset.mode;
      const proxyConfig = {
        mode: mode
      };
      
      chrome.runtime.sendMessage({ 
        action: "setProxy",
        proxyName: mode,
        config: proxyConfig
      }, (response) => {
        if (response && response.success) {
          loadProxyConfigs();
        }
      });
    });
  });
  
  // 添加代理按钮
  document.getElementById('add-proxy').addEventListener('click', () => {
    // 重置表单
    document.getElementById('proxy-form').reset();
    // 更新模态框标题
    document.querySelector('.modal-header h3').textContent = '添加代理配置';
    // 显示模态框
    document.getElementById('add-proxy-modal').style.display = 'block';
  });
  
  // 返回按钮
  document.querySelector('.back-button').addEventListener('click', () => {
    document.getElementById('add-proxy-modal').style.display = 'none';
    // 不需要重置表单，因为可能是在编辑模式下返回
  });
  
  // 代理表单提交
  document.getElementById('proxy-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('proxy-name').value.trim();
    const host = document.getElementById('proxy-host').value.trim();
    const port = document.getElementById('proxy-port').value;
    const bypassListText = document.getElementById('bypass-list').value.trim();
    
    // 处理不经过代理列表
    const bypassList = bypassListText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // 过滤空行和注释行
    
    // 改进的IP地址验证
    const isValidIP = (ip) => {
      const parts = ip.split('.');
      if (parts.length !== 4) return false;
      
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && part === num.toString();
      });
    };
    
    // 改进的域名验证
    const isValidDomain = (domain) => {
      // 基本域名格式验证
      const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!domainRegex.test(domain)) return false;
      
      // 检查是否至少包含两级域名
      const parts = domain.split('.');
      if (parts.length < 2) return false;
      
      // 检查是否存在纯数字域名段
      const hasNonNumericPart = parts.some(part => {
        // 如果部分包含任何非数字字符，返回true
        return /[a-zA-Z-]/.test(part);
      });
      
      // 必须至少有一个部分包含字母
      return hasNonNumericPart;
    };
    
    if (!isValidIP(host) && !isValidDomain(host)) {
      alert('请输入有效的IP地址（如：1.1.1.1）或域名（如：example.com）');
      return;
    }
    
    // 验证端口范围
    const portNum = parseInt(port);
    if (portNum < 1 || portNum > 65535) {
      alert('端口必须在1-65535之间');
      return;
    }
    
    const proxyConfig = {
      name: name,
      config: {
        mode: 'fixed_servers',
        scheme: document.getElementById('proxy-scheme').value,
        host: host,
        port: portNum,
        bypassList: bypassList
      }
    };
    
    // 先获取现有配置，然后添加新配置
    chrome.runtime.sendMessage({ action: "getProxyConfigs" }, (response) => {
      if (response && response.proxyConfigs) {
        const existingConfigs = response.proxyConfigs;
        
        // 检查是否存在同名配置
        if (existingConfigs[name] && !confirm('已存在同名配置，是否覆盖？')) {
          return;
        }
        
        chrome.runtime.sendMessage({ 
          action: "addProxy",
          proxy: proxyConfig,
          existingConfigs: existingConfigs  // 传递现有配置
        }, (addResponse) => {
          if (addResponse && addResponse.success) {
            document.getElementById('add-proxy-modal').style.display = 'none';
            document.getElementById('proxy-form').reset();
            loadProxyConfigs();
          }
        });
      }
    });
  });
});

function loadProxyConfigs() {
  chrome.runtime.sendMessage({ action: "getProxyConfigs" }, (response) => {
    if (response) {
      const proxyConfigs = response.proxyConfigs;
      const currentProxy = response.currentProxy;
      
      // 更新快速切换按钮状态
      updateProxyOptions(currentProxy);
      // 渲染代理列表
      renderProxyList(proxyConfigs, currentProxy);
    }
  });
}

function updateProxyOptions(currentProxy) {
  document.querySelectorAll('.proxy-option').forEach(button => {
    const mode = button.dataset.mode;
    if (mode === currentProxy) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}

function renderProxyList(proxyConfigs, currentProxy) {
  const proxyList = document.getElementById('proxy-list');
  proxyList.innerHTML = '';
  
  Object.entries(proxyConfigs).forEach(([name, config]) => {
    if (name !== 'direct' && name !== 'system') {
      const item = document.createElement('div');
      item.className = 'proxy-item';
      if (name === currentProxy) {
        item.classList.add('active');
      }
      
      // 创建代理名称元素
      const proxyName = document.createElement('span');
      proxyName.className = 'proxy-name';
      proxyName.textContent = name;
      
      // 创建工具提示元素
      const tooltip = document.createElement('span');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${config.scheme}://${config.host}:${config.port}`;
      
      // 创建操作按钮容器
      const actions = document.createElement('div');
      actions.className = 'actions';
      
      // 创建修改按钮
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.title = '修改';
      editBtn.textContent = '✎';
      
      // 创建删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = '删除';
      deleteBtn.textContent = '×';
      
      // 添加修改事件处理
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        
        // 更新模态框标题
        document.querySelector('.modal-header h3').textContent = '修改代理配置';
        
        // 填充表单数据
        document.getElementById('proxy-name').value = name;
        document.getElementById('proxy-scheme').value = config.scheme;
        document.getElementById('proxy-host').value = config.host;
        document.getElementById('proxy-port').value = config.port;
        // 修复bypassList的显示，确保每行一个地址
        document.getElementById('bypass-list').value = config.bypassList ? config.bypassList.join('\n') : '';
        
        // 显示模态框
        document.getElementById('add-proxy-modal').style.display = 'block';
      });
      
      // 添加删除事件处理
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        
        if (confirm(`确定要删除代理配置"${name}"吗？`)) {
          chrome.runtime.sendMessage({ 
            action: "deleteProxy",
            proxyName: name
          }, (response) => {
            if (response && response.success) {
              loadProxyConfigs();
            }
          });
        }
      });
      
      // 添加代理切换事件
      item.addEventListener('click', () => {
        chrome.runtime.sendMessage({ 
          action: "setProxy",
          proxyName: name,
          config: config
        }, (response) => {
          if (response && response.success) {
            loadProxyConfigs();
          }
        });
      });
      
      // 组装操作按钮
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      
      // 组装代理项
      item.appendChild(proxyName);
      item.appendChild(tooltip);
      item.appendChild(actions);
      proxyList.appendChild(item);
    }
  });
}
