import AudioHandler from './audio';
import CryptoUtil from './crypto';
import WindowHandler from './window';

let fs = window.RequestFileSystem || window.webkitRequestFileSystem;

$(function() {
  const audio = new AudioHandler();
  const cryptoUtil = new CryptoUtil();
  const windowHandler = new WindowHandler();

  let newMessages = 0;
  let FADE_TIME = 150; // ms
  let TYPING_TIMER_LENGTH = 400; // ms

  let COLORS = [
    '#e21400', '#ffe400', '#ff8f00',
    '#58dc00', '#dd9cff', '#4ae8c4',
    '#3b88eb', '#f47777', '#d300e7',
  ];  

  let $window = $(window);
  let $messages = $('.messages'); // Messages area
  let $inputMessage = $('.inputMessage'); // Input message input box
  let $key = $('.key');
  let $genKey = $('.new_key');
  let $participants = $('#participants');

  let $chatPage = $('.chat.page'); // The chatroom page

  let users = [];

  // Prompt for setting a username
  let username;
  let myUserId;
  let connected = false;
  let typing = false;
  let lastTypingTime;

  let roomId = window.location.pathname.length ? window.location.pathname : null;

  let keys = {};

  if (!roomId) return;

  $('input.share-text').val(document.location.protocol + "//" + document.location.host + roomId);  

  $('input.share-text').click(function() {
    $(this).focus();
    $(this).select();
    this.setSelectionRange(0, 9999);
  });

  let socket = io(roomId);

  FastClick.attach(document.body);

  function addParticipantsMessage (data) {
    let message = '';
    let headerMsg = '';

    $participants.text(data.numUsers);
  }

  // Sets the client's username
  function initChat () {
    username = window.username;
    // warn not incognitor
    if (!fs) {
      console.log('no fs');
    } else {
      fs(window.TEMPORARY,
        100,
        log.bind(log, "WARNING: Your browser is not in incognito mode!"));
    }

    // If the username is valid
    if (username) {
      $chatPage.show();
      $inputMessage.focus();

      Promise.all([
        cryptoUtil.createPrimaryKeys()
      ])
      .then(function(data) {
        keys = {
          public: data[0].publicKey,
          private: data[0].privateKey
        };
        return Promise.all([
          cryptoUtil.exportKey(data[0].publicKey, "spki")
        ]);
      })
      .then(function(exportedKeys) {
        // Tell the server your username and send public keys
        socket.emit('add user', {
          username: username,
          publicKey: exportedKeys[0]
        });
      });
    }
  }

  // Log a message
  function log (message, options) {
    let html = options && options.html === true || false;
    let $el;
    if (html) {
      $el = $('<li>').addClass('log').html(message);
    } else {
      $el = $('<li>').addClass('log').text(message);
    }
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    if (!data.message.trim().length) return;

    // Don't fade the message in if there is an 'X was typing'
    let $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    let $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    let $messageBodyDiv = $('<span class="messageBody">')
      .html(data.message);

    let typingClass = data.typing ? 'typing' : '';
    let $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    let $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }

    $messages[0].scrollTop = $messages[0].scrollHeight; // minus 60 for key
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    let message = $('<div/>').html(input).text();
    message = Autolinker.link(message);
    return message;
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        let typingTimer = (new Date()).getTime();
        let timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    let hash = 7;
    for (let i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    let index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    // When the client hits ENTER on their keyboard and chat message input is focused
    if (event.which === 13 && $('.inputMessage').is(':focus')) {
      sendMessage();
      socket.emit('stop typing');
      typing = false;
    }

  });

  $inputMessage.on('input propertychange paste change', function() {
    updateTyping();
    let message = $(this).val().trim();
    if (message.length) {
      $('#send-message-btn').addClass('active');
    } else {
      $('#send-message-btn').removeClass('active');
    }
  });

  // Select message input when closing modal
  $('.modal').on('hidden.bs.modal', function (e) {
    $inputMessage.focus();      
  });

  // Select message input when clicking message body, unless selecting text
  $('.messages').on('click', function() {
    if (!getSelectedText()) {
      $inputMessage.focus();
    }
  });

  function getSelectedText() {
    var text = "";
    if (typeof window.getSelection != "undefined") {
      text = window.getSelection().toString();
    } else if (typeof document.selection != "undefined" && document.selection.type == "Text") {
      text = document.selection.createRange().text;
    }
    return text;
  }

  // Whenever the server emits 'login', log the login message
  socket.on('user joined', function (data) {
    connected = true;
    addParticipantsMessage(data);

    let importKeysPromises = [];
    
    // Import all user keys if not already there
    _.each(data.users, function(user) {
      if (!_.findWhere(users, {id: user.id})) {
        let promise = new Promise(function(resolve, reject) {
          let currentUser = user;
          Promise.all([
            cryptoUtil.importPrimaryKey(currentUser.publicKey, "spki")
          ])
          .then(function(keys) {
            users.push({
              id: currentUser.id,
              username: currentUser.username,
              publicKey: keys[0]
            });
            resolve();
          });
        });
        importKeysPromises.push(promise);
      }
    });

    if (!myUserId) {
      // Set my id if not already set
      let me = _.findWhere(data.users, {username: username});
      myUserId = me.id;
    }

    Promise.all(importKeysPromises)
    .then(function() {
      // All users' keys have been imported
      if (data.numUsers === 1) {
        $('#first-modal').modal('show');
      }

      log(data.username + ' joined');

      renderParticipantsList();
    });      

  });

  // Sends a chat message
  function sendMessage () {
    // Don't send unless other users exist
    if (users.length <= 1) return;

    let message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      $('#send-message-btn').removeClass('active');      
      addChatMessage({
        username: username,
        message: message
      });
      let vector = cryptoUtil.crypto.getRandomValues(new Uint8Array(16));

      let secretKey;
      let secretKeys;
      let messageData;
      let signature;
      let signingKey;
      let encryptedMessageData;

      // Generate new secret key and vector for each message
      cryptoUtil.createSecretKey()
      .then(function(key) {
        secretKey = key;
        return cryptoUtil.createSigningKey();
      })
      .then(function(key) {
        signingKey = key;
        // Generate secretKey and encrypt with each user's public key
        let promises = [];
        _.each(users, function(user) {
          // If not me
          if (user.username !== window.username) {
            let promise = new Promise(function(resolve, reject) {
              let thisUser = user;

              let secretKeyStr;

              // Export secret key
              cryptoUtil.exportKey(secretKey, "raw")
              .then(function(data) {
                return cryptoUtil.encryptSecretKey(data, thisUser.publicKey);
              })
              .then(function(encryptedSecretKey) {
                let encData = new Uint8Array(encryptedSecretKey);
                secretKeyStr = cryptoUtil.convertArrayBufferViewToString(encData);
                // Export HMAC signing key
                return cryptoUtil.exportKey(signingKey, "raw");
              })
              .then(function(data) {
                // Encrypt signing key with user's public key
                return cryptoUtil.encryptSigningKey(data, thisUser.publicKey);
              })
              .then(function(encryptedSigningKey) {
                let encData = new Uint8Array(encryptedSigningKey);
                var str = cryptoUtil.convertArrayBufferViewToString(encData);
                resolve({
                  id: thisUser.id,
                  secretKey: secretKeyStr,
                  encryptedSigningKey: str
                });
              });
            });
            promises.push(promise);
          }
        });
        return Promise.all(promises);
      })
      .then(function(data) {
        secretKeys = data;
        messageData = cryptoUtil.convertStringToArrayBufferView(message);
        return cryptoUtil.signKey(messageData, signingKey);
      })
      .then(function(data) {
        signature = data;
        return cryptoUtil.encryptMessage(messageData, secretKey, vector);
      })
      .then(function(data) {
        encryptedMessageData = data;
        let msg = cryptoUtil.convertArrayBufferViewToString(new Uint8Array(encryptedMessageData));
        let vct = cryptoUtil.convertArrayBufferViewToString(new Uint8Array(vector));
        let sig = cryptoUtil.convertArrayBufferViewToString(new Uint8Array(signature));
        socket.emit('new message', {
          message: msg,
          vector: vct,
          secretKeys: secretKeys,
          signature: sig
        });
      });
    }
  }

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    // Don't show messages if no key
    if (!windowHandler.isActive) {
      windowHandler.notifyFavicon();
      audio.play();
    }

    let message = data.message;
    let messageData = cryptoUtil.convertStringToArrayBufferView(message);
    let username = data.username; 
    let senderId = data.id
    let vector = data.vector;
    let vectorData = cryptoUtil.convertStringToArrayBufferView(vector);
    let secretKeys = data.secretKeys;
    let decryptedMessageData;
    let decryptedMessage;   

    let mySecretKey = _.find(secretKeys, function(key) {
      return key.id === myUserId;
    });
    let signature = data.signature;
    let signatureData = cryptoUtil.convertStringToArrayBufferView(signature);
    let secretKeyArrayBuffer = cryptoUtil.convertStringToArrayBufferView(mySecretKey.secretKey);
    let signingKeyArrayBuffer = cryptoUtil.convertStringToArrayBufferView(mySecretKey.encryptedSigningKey);

    cryptoUtil.decryptSecretKey(secretKeyArrayBuffer, keys.private)
    .then(function(data) {
      return cryptoUtil.importSecretKey(new Uint8Array(data), "raw");
    })
    .then(function(data) {
      let secretKey = data;
      return cryptoUtil.decryptMessage(messageData, secretKey, vectorData);
    })
    .then(function(data) {
      decryptedMessageData = data;
      decryptedMessage = cryptoUtil.convertArrayBufferViewToString(new Uint8Array(data))
      return cryptoUtil.decryptSigningKey(signingKeyArrayBuffer, keys.private)
    })
    .then(function(data) {
      return cryptoUtil.importSigningKey(new Uint8Array(data), "raw");
    })
    .then(function(data) {
      let signingKey = data;
      return cryptoUtil.verifyKey(signatureData, decryptedMessageData, signingKey);
    })
    .then(function(bool) {
      if (bool) {
        addChatMessage({
          username: username,
          message: decryptedMessage
        });          
      }
    });
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);

    users = _.without(users, _.findWhere(users, {id: data.id}));

    renderParticipantsList();
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  initChat();

  // Nav links
  $('a#settings-nav').click(function() {
    $('#settings-modal').modal('show');
  });

  $('a#about-nav').click(function() {
    $('#about-modal').modal('show');
  });

  $('[data-toggle="tooltip"]').tooltip();

  $('.navbar .participants').click(function() {
    renderParticipantsList();
    $('#participants-modal').modal('show');
  });

  function renderParticipantsList() {
    $('#participants-modal ul.users').empty();
    _.each(users, function(user) {
      let li;
      if (user.username === window.username) {
        // User is me
        li = $("<li>" + user.username + " <span class='you'>(you)</span></li>").css('color', getUsernameColor(user.username));
      } else {
        li = $("<li>" + user.username + "</li>").css('color', getUsernameColor(user.username));
      }
      $('#participants-modal ul.users')
        .append(li);        
    });    
  }

  $('#send-message-btn').click(function() {
    sendMessage();
    socket.emit('stop typing');
    typing = false;
  });

  $('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
  });

  let audioSwitch = $('input.bs-switch').bootstrapSwitch();

  audioSwitch.on('switchChange.bootstrapSwitch', function(event, state) {
    audio.soundEnabled = state;
  });

});
