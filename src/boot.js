/* Стоп-минус — точка входа content script (только кабинет WB). */
(function () {
  'use strict';

  if (!/^seller\.wildberries\.ru$/i.test(location.hostname)) return;

  function boot() {
    try {
      window.WbMarginEngine.init({});
    } catch (e) {
      /* тихий отказ: страница не должна ломаться из-за расширения */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
      if (!msg) return;
      if (msg.type === 'wbmg:calibrate') {
        window.WbMarginEngine.startCalibration();
        if (respond) respond({ ok: true });
      }
      if (msg.type === 'wbmg:manual') {
        window.WbMarginEngine.enableManual();
        if (respond) respond({ ok: true });
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes['wbmg.v1']) window.WbMarginEngine.reload();
    });
  }
})();
