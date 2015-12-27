/*
Copyright (c) 2015 Zohaib
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function (vue) {
  var md = new markdownit();

  var showNotification = function (message) {
    if (!("Notification" in window)) {
      return false;
    } else if (Notification.permission === "granted") {
      var notification = new Notification(message);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission(function (permission) {
        if (permission === "granted") {
          var notification = new Notification(message);
        }
      });
    }

    return true;
  };

  vue.filter('markdown', function (value) {
    return md.render(value);
  });

  vue.filter('avatar_url', function (value) {
    return 'http://api.adorable.io/avatars/256/' + value + '.png';
  });

  vue.component('chat-message', vue.extend({
    props: ['message'],
    template: '#chat-message',
    ready: function () {
      this.$dispatch("chat-message-added", this.message);
    }
  }));

  vue.component('chat-log', vue.extend({
    props: ['messages'],
    template: '#chat-messages',
    methods: {
      scrollToBottom: function () {
        this.$el.scrollTop = this.$el.scrollHeight;
      },
    },
  }));

  vue.component('chat-compose', vue.extend({
    template: '#chat-compose',
    data: function () {
      return {
        message: '',
      };
    },
    methods: {
      enterPressed: function (e) {
        var msg = this.message;
        if (e.shiftKey){
          this.$set('message', msg+'\n');
          return;
        }

        this.$set('message', '');
        this.$dispatch('send-message', msg);
      },

      tabPressed: function () {
        var msg = this.$get('message');
        this.$set('message', msg+'  ');
      },
    },
  }));

  vue.component('app-bar', vue.extend({
    props: ['userId'],
    template: '#app-bar',
    data: function () {
      return {
        sound: false
      };
    },
    methods: {
    }
  }));

  vue.component('groups-list', vue.extend({
    template: '#groups-list',
    data: function () {
      return {
        groups: [],
        selected: "",
      };
    },
    ready: function () {
      this.groupsInfo = {};
      this.$on("group_joined", this.groupJoined);
      this.$on("group_switched", this.groupSwitch);
      this.$on("group_left", this.groupLeft);
      this.$on("message_new", this.newMessage)
    },
    methods: {
      selectGroup: function (id) {
        this._setUnread(id, 0);
        this.$set("selected", id);
        this.$dispatch("switch", id);
      },

      leaveGroup: function (id) {
        this.$dispatch("leave", id);
      },

      groupSwitch: function (group) {
        this.selectGroup(group);
      },

      groupJoined: function (group) {
        var groupInfo = this.groupsInfo[group] = this.groupsInfo[group] || {name: group, unread: 0, index: this.groups.length};
        this.groups.push(groupInfo);
      },

      groupLeft: function (group) {
        var g = this.groupsInfo[group] || {index: -1};
        if (g.index != -1){
          this.groups.splice(g.index, 1);
        }
      },

      newMessage: function (msg) {
        if (this.selected == msg.to || !this.groupsInfo[msg.to]) {
          return true;
        }

        this._setUnread(msg.to, this._getUnread(msg.to) + 1);
        return true;
      },

      _getUnread: function (g) {
        return (this.groupsInfo[g] && this.groupsInfo[g].unread) || 0;
      },

      _setUnread: function (g, count) {
        vue.set(this.groupsInfo[g], "unread", count);
        return true;
      }
    }
  }));

  var ToggleButtonMixin = {
    data: function () {
      return {enabled: false};
    },
    methods: {
      toggle: function () {
        this.$set("enabled", !this.$get("enabled"));
      }
    }
  };

  vue.component('sound-notification-button', vue.extend({
    template: '#sound-notification-button',
    mixins: [ToggleButtonMixin],
    props: ["ignoreFor"],
    ready: function () {
      this.$on("message_new", this.onNotification);
    },
    methods: {
      onNotification: function (msg) {
        if (this.enabled && msg.from != this.ignoreFor){
          var snd = new Audio("/static/notif.mp3");
          snd.play();
        }
      }
    }
  }));

  var groupsLog = {};
  var vueApp = new vue({
    el: '#root',
    data: {
      nick: "",
      currentGroup: {name: '', messages: []},
      isConnected: false,
    },

    ready: function (argument) {
      this.transport = new core.Transport();
      this.transport.events.on('connected', this.onConnected);
      this.transport.events.on('disconnected', this.onDisconnected);
      this.transport.events.on('message', this.onMessage);
      this.transport.events.on('joined', this.onJoin);
      this.transport.events.on('leave', this.onLeave);
      this.transport.events.on('switch', this.onSwitch);
      this.transport.events.on('nick-changed', this.changeNick);

      this.$on("switch", this.onSwitch);
      this.$on("leave", function (group) {
        this.transport.send(group, "/leave "+group);
      });
      this.$watch("currentGroup.name", function (newVal, oldVal) {
        this.$broadcast("group_switched", newVal);
      });
    },

    methods: {
      connect: function () {
        this.transport.connect();
      },

      sendMessage: function (msg) {
        // Don't let user send message on default group
        if (this.currentGroup.name == this.defaultGroup && msg[0] != "/"){
          this._appendMetaMessage(
            "You can only send a command here ...\n"+
            "Valid commands are: \n"+
            "/join <group_name> to join a group (case-sensitive)\n"+
            "/nick <new_name> for changing your nick (case-sensitive)\n"+
            "/switch <group_name> to switch to a joined group (case-sensitive)\n"
          );
          return;
        }

        this.transport.send(this.currentGroup.name, msg);
      },

      switchGroup: function (grp) {
        this.onSwitch(grp);
      },

      onMessage: function (m) {
        if (!this.defaultGroup) {
          this.defaultGroup = m.from;
        }

        this._appendMessage(m);
      },

      onConnected: function () {
        this.$set('isConnected', true);
        this.$broadcast("connection_on");
        this.transport.setNick(this.nick);
        this.$set('nick', this.transport.id);
      },

      changeNick: function (newNick) {
        this.$set('nick', newNick);
      },

      onDisconnected: function () {
        this.$set('isConnected', false);
        this.$broadcast("connection_off");
      },

      onJoin: function (joinInfo) {
        this._getOrCreateGroupLog(joinInfo.to);
        this._appendMessage({
          to: joinInfo.to,
          from: joinInfo.from,
          msg: joinInfo.from + " has joined discussion",
          delivery_time: new Date()
        });
        if (this.currentGroup.name == this.defaultGroup) {
          this.switchGroup(joinInfo.to);
        }
      },

      onLeave: function (info) {
        if (info.from == this.nick) {
          delete groupsLog[info.to];
          this.$broadcast("group_left", info.to);
        } else {
          this._appendMessage({
            to: info.to,
            from: info.from,
            msg: info.from + " has left",
            delivery_time: new Date()
          });
        }

        if (this.currentGroup.name == info.to && this.nick == info.from) {
          this.switchGroup(this.defaultGroup);
        }
      },

      onSwitch: function (group) {
        if (!this._getGroupLog(group)) {
          alert('You have not joined group '+group);
          return true;
        }

        if (this.currentGroup.name == group) {
          return true;
        }

        this.$set('currentGroup.name', group);
        this.$set('currentGroup.messages', groupsLog[group]);
        return false;
      },

      _appendMessage: function (m) {
        var groupLog = this._getOrCreateGroupLog(m.to);

        if (!this.currentGroup.name) {
          this.$set('currentGroup.name', m.to);
          this.$set('currentGroup.messages', groupLog);
        }

        groupLog.push(m);
        this.$broadcast('message_new', m);
      },

      _appendMetaMessage: function (msg) {
        this.currentGroup.messages.push({isMeta: true, msg: msg});
      },

      _getOrCreateGroupLog: function (g) {
        if (!groupsLog[g]) {
          groupsLog[g] = [];
          this.$broadcast("group_joined", g);
        }

        return groupsLog[g];
      },

      _getGroupLog: function (g) {
        return groupsLog[g] || null;
      }
    },
  });

  vue.config.debug = true;
})(Vue);
