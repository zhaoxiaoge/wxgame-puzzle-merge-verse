/**
 * 广告管理：激励视频 / Banner / 插屏
 *
 * 开发阶段（无正式广告位）：DEV_MODE = true，激励视频直接发放奖励，便于测试完整流程。
 * 上线前：在 MP 后台「流量主 → 广告位管理」创建广告位，填入 AD_UNITS 并把 DEV_MODE 改为 false。
 * 流量主开通条件：小游戏累计独立访客 UV > 500 且无违规（官方文档）。
 */
const AD_UNITS = {
  reward: '',        // TODO(上线前): 激励视频广告位 adunit-xxxx
  banner: '',        // TODO(上线前): Banner 广告位
  interstitial: ''   // TODO(上线前): 插屏广告位
};
const DEV_MODE = true;

let rewardedAd = null;
let bannerAd = null;
let bannerVisible = false;
let interstitialAd = null;

/* ---------- 激励视频 ---------- */

function hasReward() {
  return !!AD_UNITS.reward && !DEV_MODE;
}

/**
 * 拉起激励视频
 * @param cb (ok:boolean) => void  ok=true 表示完整观看，可发放奖励
 */
function showRewarded(cb) {
  if (!hasReward()) {
    wx.showToast({ title: '恭喜幸运玩家 · 本次直接解锁', icon: 'none' });
    cb(true);
    return;
  }
  if (!rewardedAd) {
    rewardedAd = wx.createRewardedVideoAd({ adUnitId: AD_UNITS.reward });
    rewardedAd.onError(function (err) {
      console.error('[ads] rewarded onError:', err && err.errMsg);
    });
  }
  const onClose = function (res) {
    rewardedAd.offClose(onClose);
    cb(!!(res && res.isEnded));
  };
  rewardedAd.onClose(onClose);
  rewardedAd.show().catch(function () {
    // 首次拉取失败 → 重试一次
    rewardedAd.load().then(function () {
      return rewardedAd.show();
    }).catch(function (err) {
      rewardedAd.offClose(onClose);
      console.error('[ads] rewarded show fail:', err && err.errMsg);
      cb(false);
    });
  });
}

/* ---------- Banner ---------- */

function ensureBanner() {
  if (!AD_UNITS.banner || DEV_MODE) return null;
  if (bannerAd) return bannerAd;
  const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
  bannerAd = wx.createBannerAd({
    adUnitId: AD_UNITS.banner,
    style: { left: 0, top: 0, width: info.windowWidth }
  });
  bannerAd.onResize(function (res) {
    // 固定吸底
    bannerAd.style.top = info.windowHeight - res.height;
  });
  bannerAd.onError(function (err) {
    console.error('[ads] banner onError:', err && err.errMsg);
  });
  return bannerAd;
}

/** 主菜单等场景展示 Banner（提前加载拉曝光率） */
function showBanner() {
  const b = ensureBanner();
  if (!b || bannerVisible) return;
  b.show().then(function () {
    bannerVisible = true;
  }).catch(function (err) {
    console.error('[ads] banner show fail:', err && err.errMsg);
  });
}

function hideBanner() {
  if (bannerAd && bannerVisible) {
    bannerAd.hide();
    bannerVisible = false;
  }
}

/* ---------- 插屏 ---------- */

/** 结算插屏：第 3 局起每 3 局一次（前两局不出，避免吓跑新用户） */
function maybeShowInterstitial(gamesFinished) {
  if (!AD_UNITS.interstitial || DEV_MODE) return;
  if (gamesFinished < 3 || gamesFinished % 3 !== 0) return;
  try {
    if (!interstitialAd) {
      interstitialAd = wx.createInterstitialAd({ adUnitId: AD_UNITS.interstitial });
    }
    interstitialAd.show().catch(function (err) {
      console.error('[ads] interstitial show fail:', err && err.errMsg);
    });
  } catch (e) { /* 忽略 */ }
}

module.exports = { showRewarded, showBanner, hideBanner, maybeShowInterstitial, hasReward, AD_UNITS, DEV_MODE };
