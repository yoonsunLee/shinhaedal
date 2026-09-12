/* Marks a plain click on an "IP" nav link so the IP page can play its arrival transition.
   Does not intercept navigation — the link follows its href normally. */
(function(){
  var KEY='haedal_ip_nav';
  function isPlainClick(e){
    return e.button===0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }
  document.querySelectorAll('a[href="ip/"], a[href="../ip/"]').forEach(function(a){
    if(a.target==='_blank') return;
    a.addEventListener('click', function(e){
      if(!isPlainClick(e)) return;
      try{ sessionStorage.setItem(KEY, JSON.stringify({t:Date.now()})); }catch(err){}
    });
  });
})();
