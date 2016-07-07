/**
     DigitalHomesteadLive provides a live view of digital homestead events
     Copyright (C) 2016  NigelB, eResearch, James Cook University

     This program is free software: you can redistribute it and/or modify
     it under the terms of the GNU General Public License as published by
     the Free Software Foundation, either version 3 of the License, or
     (at your option) any later version.

     This program is distributed in the hope that it will be useful,
     but WITHOUT ANY WARRANTY; without even the implied warranty of
     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
     GNU General Public License for more details.

     You should have received a copy of the GNU General Public License
     along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var LiveWeights = angular.module('LiveWeights', ['ngMdIcons']);

LiveWeights.constant('pubnub', PUBNUB({
    ssl: true,  // <- enable TLS Tunneling over TCP
    publish_key: "demo",
    subscribe_key: "sub-c-3d7ba416-92ba-11e3-b2cd-02ee2ddab7fe"
}));

LiveWeights.constant('locations', {
    110177:{
        name:"Spring Creek",
        lat: -19.66882,
        long: 146.864
    },
    110171:{
        name: "Double Barrel",
        lat: -19.66574,
        long: 146.8462
    },
    110163:{
        name: "Junction",
        lat: -19.66872,
        long: 146.8642
    }
});

LiveWeights.filter('reverse', function () {
    return function (items) {
        if (items != undefined) {
            return items.slice().reverse();
        }
        return undefined;
    };
});

LiveWeights.constant('radio_ids', [110163, 110177, 110171, 110176]);

LiveWeights.controller("LiveWeights.Main", ['$scope', 'pubnub', 'radio_ids', 'locations', function ($scope, pubnub, radio_ids, locations) {
    // console.log($scope);
    // console.log(pubnub);
    $scope.messages = [];
    $scope.heartbeats = {};
    $scope.locations = locations;
    initiate_pubnub(pubnub, radio_ids, $scope);

}]);


function split(string) {
    var data = [];
    // console.log(string);
    for (var i = 0; i < string.length; i += 2) {
        data.push(parseInt(string.substring(i, i + 2), 16));
    }
    /*
     for (var i = string.length -2; i > -1; i-= 2)
     {
     data.push(parseInt(string.substring(i, i+2), 16));
     }
     */
    return data;
}

function unpack($scope, message) {
    message.has_weight = false;

    var location = '';
    if(message['tag_id'] in $scope.locations)
    {
        location = $scope.locations[message['tag_id']].name;
    }

    if (!('data' in message)) {
        console.log("Unknown message type");
    }
    else if ('alt_user_data' in message['data']) {
        // console.log('alt');
        // console.log(message);


        msg = {
            tag_id: message['tag_id'],
            rssi: message.rssi,
            date: moment(message.time * 1000).format(),
            receiver: message.receiver,
            location: location
        };
        // console.log(moment(message.time * 1000));



        var status = message['data']['alt_user_data'];
        var tag_id = message['tag_id'];
        if(status == "000001fe")
        {
            //Start up
            // $scope.heartbeat[tag_id] = {type: "startup", time: message['time']};
            msg['type'] = "Startup";
        }else if(status == "010001fe")
        {
            //Heartbeat
            // $scope.heartbeat[tag_id] = {type: "heartbeat", time: message['time']};
            msg['type'] = "Heartbeat";
        }
        else if(status == "010001ff")
        {
            //Heartbeat
            // $scope.heartbeat[tag_id] = {type: "heartbeat", time: message['time']};
            msg['type'] = "Parse Error";
        }
        else if (status.endsWith("ff"))
        {
            msg['type'] = "Error";
        }
        $scope.messages.push(msg);

    }
    else if ('user_payload' in message['data']) {
        var encoded = message['data']['user_payload'];
        // console.log(encoded);
        var id_2 = encoded.substring(0, 8);
        var id_1 = encoded.substring(8, 16);
        var weight = encoded.substring(16, 24);
        val = restruct.int32ls("val");
        msg = {
            tag_id: message['tag_id'],
            rssi: message.rssi,
            id: [val.unpack(split(id_1)).val, val.unpack(split(id_2)).val],
            weight: val.unpack(split(weight)).val / 100,
            _weight: val.unpack(split(weight)).val,
            date: moment(message.time * 1000).format(),
            receiver: message.receiver,
            type: "Weight",
            location: location
        };
        // console.log(moment(message.time * 1000));
        $scope.messages.push(msg);
        // console.log(message);
    }
    else {
        msg = {
            tag_id: message['tag_id'],
            rssi: message.rssi,
            date: moment(message.time * 1000).format(),
            receiver: message.receiver,
            location: location,
            type: 'UNKNOWN'
        };
        $scope.messages.push(msg);
    }

    $scope.$apply();
    return message;
}

function initiate_pubnub(pubnub, radio_ids, $scope) {
    console.log(radio_ids);

    pubnub.history({
        channel: 'jcu.180181',
        callback: function (m) {
            for (message in m[0]) {
                if (radio_ids.indexOf(m[0][message].tag_id) != -1) {
                    unpack($scope, m[0][message]);
                }
            }
        },
        count: 100000, // 100 is the default
        reverse: false // false is the default
    });

    pubnub.subscribe({
        channel: "jcu.180181",
        callback: function(m){
            unpack($scope, m);
        }
    });

}