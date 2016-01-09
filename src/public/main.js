var fs=window.RequestFileSystem||window.webkitRequestFileSystem;$(function(){var isActive=false;var newMessages=0;var FADE_TIME=150;var TYPING_TIMER_LENGTH=400;var COLORS=["#e21400","#91580f","#f8a700","#f78b00","#58dc00","#287b00","#a8f07a","#4ae8c4","#3b88eb","#3824aa","#a700ff","#d300e7"];window.favicon=new Favico({animation:"pop",type:"rectangle"});var $window=$(window);var $usernameInput=$(".usernameInput");var $messages=$(".messages");var $inputMessage=$(".inputMessage");var $key=$("#key");var $genKey=$("#new_key");var $chatPage=$(".chat.page");var key=CryptoJS.SHA3(Math.random().toString(36).substring(7)).toString();$key.val(key);var username;var connected=false;var typing=false;var lastTypingTime;var $currentInput=$usernameInput.focus();var clipboard=new Clipboard(".copyable");var roomId=window.location.pathname.length?window.location.pathname:null;if(!roomId)return;var socket=io(roomId);$("#roomIdKey").text(roomId.replace("/",""));function addParticipantsMessage(data){var message="";if(data.numUsers===1){message+="There's 1 participant"}else{message+="There are "+data.numUsers+" participants"}log(message)}function setUsername(){username=window.username;if(!fs){console.log("no fs")}else{fs(window.TEMPORARY,100,log.bind(log,"WARNING: Your browser is not in incognito mode!"),log.bind(log,"Your browser is in incognito mode."))}if(username){$chatPage.show();$currentInput=$inputMessage.focus();socket.emit("add user",username)}}function sendMessage(){var message=$inputMessage.val();message=cleanInput(message);if(message&&connected){$inputMessage.val("");addChatMessage({username:username,message:message});socket.emit("new message",encrypt(message))}}function encrypt(text){return CryptoJS.AES.encrypt(text,$key.val()).toString()}function decrypt(text){return CryptoJS.AES.decrypt(text,$key.val()).toString(CryptoJS.enc.Utf8)||text}function log(message,options){var html=options&&options.html===true||false;var $el;if(html){$el=$("<li>").addClass("log").html(message)}else{$el=$("<li>").addClass("log").text(message)}addMessageElement($el,options)}function addChatMessage(data,options){var $typingMessages=getTypingMessages(data);options=options||{};if($typingMessages.length!==0){options.fade=false;$typingMessages.remove()}var $usernameDiv=$('<span class="username"/>').text(data.username).css("color",getUsernameColor(data.username));var $messageBodyDiv=$('<span class="messageBody">').text(data.message);var typingClass=data.typing?"typing":"";var $messageDiv=$('<li class="message"/>').data("username",data.username).addClass(typingClass).append($usernameDiv,$messageBodyDiv);addMessageElement($messageDiv,options)}function addChatTyping(data){data.typing=true;data.message="is typing";addChatMessage(data)}function removeChatTyping(data){getTypingMessages(data).fadeOut(function(){$(this).remove()})}function addMessageElement(el,options){var $el=$(el);if(!options){options={}}if(typeof options.fade==="undefined"){options.fade=true}if(typeof options.prepend==="undefined"){options.prepend=false}if(options.fade){$el.hide().fadeIn(FADE_TIME)}if(options.prepend){$messages.prepend($el)}else{$messages.append($el)}$messages[0].scrollTop=$messages[0].scrollHeight}function cleanInput(input){return $("<div/>").text(input).text()}function updateTyping(){if(connected){if(!typing){typing=true;socket.emit("typing")}lastTypingTime=(new Date).getTime();setTimeout(function(){var typingTimer=(new Date).getTime();var timeDiff=typingTimer-lastTypingTime;if(timeDiff>=TYPING_TIMER_LENGTH&&typing){socket.emit("stop typing");typing=false}},TYPING_TIMER_LENGTH)}}function getTypingMessages(data){return $(".typing.message").filter(function(i){return $(this).data("username")===data.username})}function getUsernameColor(username){var hash=7;for(var i=0;i<username.length;i++){hash=username.charCodeAt(i)+(hash<<5)-hash}var index=Math.abs(hash%COLORS.length);return COLORS[index]}$window.keydown(function(event){if(event.which===13&&$(".inputMessage").is(":focus")){sendMessage();socket.emit("stop typing");typing=false}if(event.which===13&&$("input#key").is(":focus")){$("#key-modal").modal("hide")}});$inputMessage.on("input",function(){updateTyping()});$inputMessage.click(function(){$inputMessage.focus()});$genKey.click(function(){var key=CryptoJS.SHA3(Math.random().toString(36).substring(7)).toString();$key.val(key)});socket.on("login",function(data){connected=true;var message="Fatty.chat - Anonymous Chat - Room ID: "+roomId.replace("/","")+'&nbsp;&nbsp;<button class="btn btn-default btn-xs copyable" data-clipboard-text="https://fatty.chat'+roomId+'">Copy link to share</button>';log(message,{prepend:true,html:true});message="This chatroom is destroyed after all participants exit. Chat history is client side only and not persistent.";log(message);addParticipantsMessage(data)});socket.on("new message",function(data){if(!isActive){newMessages++;favicon.badge(newMessages)}data.message=decrypt(data.message);addChatMessage(data)});socket.on("user joined",function(data){log(data.username+" joined");addParticipantsMessage(data)});socket.on("user left",function(data){log(data.username+" left");addParticipantsMessage(data);removeChatTyping(data)});socket.on("typing",function(data){addChatTyping(data)});socket.on("stop typing",function(data){removeChatTyping(data)});socket.on("first",function(){$(".modal").modal("show")});setUsername();$("span.key-btn").click(function(){$("#key-modal").modal("show")});window.onfocus=function(){isActive=true;newMessages=0;favicon.reset()};window.onblur=function(){isActive=false};clipboard.on("success",function(e){$(e.trigger).tooltip({title:"Copied!",trigger:"manual",placement:"auto"});$(e.trigger).tooltip("show");setTimeout(function(){$(e.trigger).tooltip("hide")},2e3)})});