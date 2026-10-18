(function () {
  var bg = document.getElementById("burger");
  var nv = document.getElementById("mnav");
  if (!bg || !nv) return;
  function closeNav() {
    nv.classList.remove("open");
    bg.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }
  bg.addEventListener("click", function () {
    var open = nv.classList.toggle("open");
    bg.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("nav-open", open);
  });
  nv.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeNav);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
})();
