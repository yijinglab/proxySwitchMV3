// 代理配置管理
let proxyConfigs = {
  direct: { mode: 'direct' },
  system: { mode: 'system' }
};
let currentProxy = 'direct';

// 更新扩展图标
function updateExtensionIcon(proxyName) {
  let iconPath;
  if (proxyName === 'direct') {
    iconPath = {
      16: 'images/direct.png',
      48: 'images/direct.png',
      128: 'images/direct.png'
    };
  } else if (proxyName === 'system') {
    iconPath = {
      16: 'images/system.png',
      48: 'images/system.png',
      128: 'images/system.png'
    };
  } else {
    iconPath = {
      16: 'images/custom.png',
      48: 'images/custom.png',
      128: 'images/custom.png'
    };
  }
  
  chrome.action.setIcon({ path: iconPath });
}

// 初始化和恢复之前的代理设置
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['proxyConfigs', 'currentProxy'], (result) => {
    if (result.proxyConfigs) {
      proxyConfigs = {
        direct: { mode: 'direct' },
        system: { mode: 'system' },
        ...result.proxyConfigs
      };
    }
    
    if (result.currentProxy) {
      currentProxy = result.currentProxy;
      // 恢复之前的代理设置
      applyProxySettings(currentProxy);
      // 更新图标
      updateExtensionIcon(currentProxy);
    }
  });
});

// 安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['proxyConfigs', 'currentProxy'], (result) => {
    if (result.proxyConfigs) {
      proxyConfigs = {
        direct: { mode: 'direct' },
        system: { mode: 'system' },
        ...result.proxyConfigs
      };
    }
    chrome.storage.local.set({ proxyConfigs });
    
    if (result.currentProxy) {
      currentProxy = result.currentProxy;
    }
    chrome.storage.local.set({ currentProxy });
    
    // 设置初始图标
    updateExtensionIcon(currentProxy);
  });
});

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "getProxyConfigs":
      chrome.storage.local.get(['proxyConfigs', 'currentProxy'], (result) => {
        const configs = result.proxyConfigs || {
          direct: { mode: 'direct' },
          system: { mode: 'system' }
        };
        const current = result.currentProxy || 'direct';
        sendResponse({ 
          proxyConfigs: configs, 
          currentProxy: current 
        });
      });
      return true;
      
    case "setProxy":
      currentProxy = message.proxyName;
      
      if (message.proxyName === 'direct') {
        chrome.proxy.settings.set({
          value: { mode: 'direct' },
          scope: 'regular'
        }, () => {
          if (!chrome.runtime.lastError) {
            chrome.storage.local.set({ currentProxy });
            updateExtensionIcon(currentProxy);
            sendResponse({ success: true });
          }
        });
      } 
      else if (message.proxyName === 'system') {
        chrome.proxy.settings.set({
          value: { mode: 'system' },
          scope: 'regular'
        }, () => {
          if (!chrome.runtime.lastError) {
            chrome.storage.local.set({ currentProxy });
            updateExtensionIcon(currentProxy);
            sendResponse({ success: true });
          }
        });
      }
      else {
        const config = message.config || proxyConfigs[message.proxyName];
        if (config && config.mode === 'fixed_servers') {
          chrome.proxy.settings.set({
            value: {
              mode: 'fixed_servers',
              rules: {
                singleProxy: {
                  scheme: config.scheme,
                  host: config.host,
                  port: parseInt(config.port)
                },
                bypassList: config.bypassList || []
              }
            },
            scope: 'regular'
          }, () => {
            if (!chrome.runtime.lastError) {
              chrome.storage.local.set({ currentProxy });
              updateExtensionIcon(currentProxy);
              sendResponse({ success: true });
            }
          });
        }
      }
      return true;
      
    case "addProxy":
      // 保持现有配置并添加新配置
      const updatedConfigs = {
        ...(message.existingConfigs || proxyConfigs),  // 使用传入的现有配置或当前配置
        [message.proxy.name]: message.proxy.config
      };
      
      // 更新内存中的配置
      proxyConfigs = updatedConfigs;
      
      // 保存到存储
      chrome.storage.local.set({ proxyConfigs: updatedConfigs }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving proxy configs:', chrome.runtime.lastError);
          sendResponse({ success: false });
        } else {
          console.log('Successfully saved proxy configs:', updatedConfigs);
          sendResponse({ success: true });
        }
      });
      return true;

    case "deleteProxy":
      // 获取当前配置
      chrome.storage.local.get(['proxyConfigs', 'currentProxy'], (result) => {
        const configs = result.proxyConfigs || {};
        const current = result.currentProxy;

        // 如果要删除的是当前使用的代理，先切换到直连模式
        if (current === message.proxyName) {
          applyProxySettings('direct');
          currentProxy = 'direct';
          chrome.storage.local.set({ currentProxy: 'direct' });
        }

        // 删除指定的代理配置
        delete configs[message.proxyName];

        // 保存更新后的配置
        chrome.storage.local.set({ proxyConfigs: configs }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false });
          } else {
            proxyConfigs = configs;
            sendResponse({ success: true });
          }
        });
      });
      return true;
  }
});

// 应用代理设置的辅助函数
function applyProxySettings(proxyName) {
  const config = proxyConfigs[proxyName];
  if (!config) return;

  if (proxyName === 'direct') {
    chrome.proxy.settings.set({
      value: { mode: 'direct' },
      scope: 'regular'
    });
  } 
  else if (proxyName === 'system') {
    chrome.proxy.settings.set({
      value: { mode: 'system' },
      scope: 'regular'
    });
  }
  else if (config.mode === 'fixed_servers') {
    chrome.proxy.settings.set({
      value: {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: config.scheme,
            host: config.host,
            port: parseInt(config.port)
          },
          bypassList: config.bypassList || []
        }
      },
      scope: 'regular'
    });
  }
}

// 添加代理设置变更监听器（用于调试）
// chrome.proxy.settings.onChange.addListener((details) => {
//   console.log('Proxy settings changed:', details);
// });


