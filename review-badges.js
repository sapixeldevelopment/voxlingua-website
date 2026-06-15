/** Smart badge placement when multiple review marks overlap (shared: app + web viewer). */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ReviewBadges = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BADGE_R = 14;

  function groupIdOf(c) {
    return c.groupId ?? c.id;
  }

  function rectCenter(rect) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }

  function rectsOverlap(a, b, pad = 0) {
    return !(
      a.x + a.width + pad < b.x - pad ||
      b.x + b.width + pad < a.x - pad ||
      a.y + a.height + pad < b.y - pad ||
      b.y + b.height + pad < a.y - pad
    );
  }

  function defaultBadge(rect) {
    return { x: rect.x + 8 + BADGE_R, y: rect.y + 8 + BADGE_R };
  }

  function clampBadge(pos, imgW, imgH) {
    return {
      x: Math.max(BADGE_R + 2, Math.min(imgW - BADGE_R - 2, pos.x)),
      y: Math.max(BADGE_R + 2, Math.min(imgH - BADGE_R - 2, pos.y)),
    };
  }

  function clusterEntries(entries) {
    const clusters = [];
    entries.forEach(entry => {
      let cluster = clusters.find(c =>
        c.some(other =>
          rectsOverlap(entry.rect, other.rect, 6) ||
          Math.hypot(entry.cx - other.cx, entry.cy - other.cy) < BADGE_R * 3.2
        )
      );
      if (!cluster) {
        cluster = [];
        clusters.push(cluster);
      }
      cluster.push(entry);
    });
    return clusters;
  }

  function layoutCluster(cluster, imgW, imgH) {
    if (cluster.length <= 1) {
      const e = cluster[0];
      const pos = clampBadge(defaultBadge(e.rect), imgW, imgH);
      e.badgeX = pos.x;
      e.badgeY = pos.y;
      e.leader = false;
      return;
    }

    const cx = cluster.reduce((s, e) => s + e.cx, 0) / cluster.length;
    const cy = cluster.reduce((s, e) => s + e.cy, 0) / cluster.length;
    const minX = Math.min(...cluster.map(e => e.rect.x));
    const minY = Math.min(...cluster.map(e => e.rect.y));
    const maxX = Math.max(...cluster.map(e => e.rect.x + e.rect.width));
    const maxY = Math.max(...cluster.map(e => e.rect.y + e.rect.height));
    const boxCx = (minX + maxX) / 2;
    const boxCy = (minY + maxY) / 2;
    const spread = Math.max(
      BADGE_R * 2.4,
      Math.min(maxX - minX, maxY - minY) * 0.35 + BADGE_R * cluster.length * 0.35
    );
    const start = -Math.PI / 2 - ((cluster.length - 1) * 0.42) / 2;

    cluster
      .slice()
      .sort((a, b) => a.groupNum - b.groupNum)
      .forEach((entry, i) => {
        const angle = start + i * 0.42;
        const pos = clampBadge({
          x: boxCx + Math.cos(angle) * spread,
          y: boxCy + Math.sin(angle) * spread - BADGE_R * 0.5,
        }, imgW, imgH);
        entry.badgeX = pos.x;
        entry.badgeY = pos.y;
        entry.leader = true;
        entry.leaderX = entry.cx;
        entry.leaderY = entry.cy;
      });
  }

  /**
   * @param {Array} callouts
   * @param {(c: object) => number} groupNumberFn
   * @param {number} imgW
   * @param {number} imgH
   * @returns {Map<number, {badgeX,badgeY,leader?,leaderX?,leaderY?}>}
   */
  function computeBadgeLayouts(callouts, groupNumberFn, imgW, imgH) {
    const entries = callouts.map(c => {
      const center = rectCenter(c.rect);
      return {
        id: c.id,
        groupNum: groupNumberFn(c),
        rect: c.rect,
        cx: center.x,
        cy: center.y,
      };
    });

    clusterEntries(entries).forEach(cluster => layoutCluster(cluster, imgW, imgH));

    const map = new Map();
    entries.forEach(e => {
      map.set(e.id, {
        badgeX: e.badgeX,
        badgeY: e.badgeY,
        leader: !!e.leader,
        leaderX: e.leaderX,
        leaderY: e.leaderY,
      });
    });
    return map;
  }

  return {
    BADGE_R,
    groupIdOf,
    computeBadgeLayouts,
  };
}));
