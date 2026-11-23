// Loaded by the 26VEM workbench page before its own scripts. The workbench's 评分器 section now lives at
// scorer/ (the live board), so old scorer links (#/scorer, #/scorer/t2, #/scorer/samples …) and links to the
// board's own pages (#/t1 … #/t3) land on the matching new page instead of the retired scorer.
(function () {
  "use strict";
  var MAP = [
    [/^#\/scorer\/t2(?:[/?]|$)/, "t2a"],
    [/^#\/scorer(?:[/?]|$)/, "t1"],
    [/^#\/(t1|t2a|t2b|t3)(?:[/?]|$)/, null]
  ];

  function target(hash) {
    for (var i = 0; i < MAP.length; i++) {
      var m = MAP[i][0].exec(hash || "");
      if (m) return "scorer/" + (MAP[i][1] ? "#/" + MAP[i][1] : hash);
    }
    return null;
  }

  function follow() {
    var to = target(location.hash);
    if (to) location.replace(to);
  }

  follow();
  window.addEventListener("hashchange", follow);
  // Catch clicks before the workbench router renders its old scorer for a moment.
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href^='#/']");
    var to = link && target(link.getAttribute("href"));
    if (!to || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    location.assign(to);
  }, true);
})();
