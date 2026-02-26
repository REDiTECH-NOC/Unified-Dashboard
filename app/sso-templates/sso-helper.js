(async function(){
var status=document.getElementById('status');
var spinner=document.getElementById('spinner');
try{
var hash=window.location.hash.substring(1);
if(!hash)throw new Error('No authentication payload.');
status.textContent='Authenticating...';
var payload=JSON.parse(atob(hash));
if(!payload.u||!payload.p)throw new Error('Invalid payload.');
var resp=await fetch('/webclient/api/Login/GetAccessToken',{
method:'POST',
headers:{'Content-Type':'application/json'},
credentials:'include',
body:JSON.stringify({Username:payload.u,Password:payload.p,SecurityCode:''})
});
var data=await resp.json();
if(data.Status!=='AuthSuccess')throw new Error('Auth failed: '+(data.Status||'Unknown'));
status.textContent='Authenticated! Opening admin console...';
window.history.replaceState(null,'','/sso-helper.html');
setTimeout(function(){window.location.replace('/#/office/dashboard');},400);
}catch(err){
spinner.style.display='none';
status.innerHTML='Connection failed.<div class="error">'+err.message+'</div>';
}
})();
