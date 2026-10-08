/**
 * 分享：全局默认分享卡片 + 战绩截图分享
 * - wx.onShareAppMessage 注册右上角菜单分享
 * - shareScore 截取当前画面作为分享图（canvas.toTempFilePathSync）
 */
let mainCanvas = null;

function setCanvas(canvas) {
  mainCanvas = canvas;
}

function initShare() {
  try { wx.showShareMenu({}); } catch (e) { /* 部分环境不支持 */ }
  wx.onShareAppMessage(function () {
    return { title: '益智合成小宇宙 · 合成星尘，点亮你的小宇宙' };
  });
}

/** 分享战绩：截当前画面为分享图，失败则用微信默认截图 */
function shareScore(score, best) {
  let imageUrl = '';
  if (mainCanvas && mainCanvas.toTempFilePathSync) {
    try {
      const res = mainCanvas.toTempFilePathSync({
        x: 0,
        y: 0,
        width: mainCanvas.width,
        height: mainCanvas.height,
        destWidth: mainCanvas.width,
        destHeight: mainCanvas.height
      });
      if (res && res.tempFilePath) imageUrl = res.tempFilePath;
    } catch (e) { /* 截图失败降级 */ }
  }
  wx.shareAppMessage({
    title: '我在《益智合成小宇宙》拿了 ' + score + ' 分（最高 ' + best + '），来挑战！',
    imageUrl: imageUrl
  });
}

module.exports = { setCanvas, initShare, shareScore };
