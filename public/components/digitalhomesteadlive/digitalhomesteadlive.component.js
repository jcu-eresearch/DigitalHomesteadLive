function register_component(module, pubnub, pubnub_channels, locations)
{
    module.component(
    'digitalHomesteadLive', {
        templateUrl:"js/digitalhomesteadlive/digitalhomesteadlive.templ.html",
        controller: ['$scope', 'pubnub', 'pubnub_channels', 'locations', LiveController]
    });

    module.constant('pubnub', pubnub);
    module.constant('pubnub_channels', pubnub_channels);
    module.constant('locations', locations);

    module.filter('reverse', function () {
        return function (items) {
            if (items != undefined) {
                return items.slice().reverse();
            }
            return undefined;
        };
    });
}

function LiveController($scope, pubnub, pubnub_channels, locations)
{
    $scope.messages = [];
    $scope.heartbeats = {};
    $scope.locations = locations;

    function accept(message)
    {
        if(message.tag_id in locations)
        {
            return true;
        }
        return false;
    }
    initiate_pubnub(pubnub, accept, pubnub_channels, $scope);

}

function initiate_pubnub(pubnub, accept, pubnub_channels, $scope) {

    pubnub.history({
        channel: pubnub_channels,
        callback: function (m) {
            for (message in m[0]) {
                if (accept(m[0][message])) {
                    unpack($scope, m[0][message]);
                }
            }
        },
        count: 100000, // 100 is the default
        reverse: false // false is the default
    });

    pubnub.subscribe({
        channel: pubnub_channels,
        callback: function(m){
            if(accept(m)) {
                unpack($scope, m);
            }
        }
    });

}

function split(string) {
    var data = [];
    for (var i = 0; i < string.length; i += 2) {
        data.push(parseInt(string.substring(i, i + 2), 16));
    }
    return data;
}

function unpack($scope, message) {
    //Filter out tags we are not interested in
    if(!(message['tag_id'] in $scope.locations))
    {
        return;
    }

    var location = '';
    if(message['tag_id'] in $scope.locations)
    {
        location = $scope.locations[message['tag_id']].name;
    }

    if (!('data' in message)) {
        console.log("Unknown message type");
    }
    // Unpack Status Messages
    else if ('alt_user_data' in message['data']) {

        msg = {
            tag_id: message['tag_id'],
            rssi: message.rssi,
            date: moment(message.time * 1000).format(),
            receiver: message.receiver,
            location: location,
            has_weight: false
        };


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

        var id_a = encoded.substring(0, 16);
        var id_b = split(id_a).reverse();
        var id_c = id_b.map(function(int){return int.toString(16)});
        var id_d = id_c.map(function(hex){if(hex.length == 1){return '0'+hex} return hex;});

        var weight = encoded.substring(16, 24);

        var dec = Decimal('0x' + id_d.join(""));
        var id = dec.toString();
        if(id == "18446744073709551615")
        {
            id = "-1";
        }

        val = restruct.int32ls("val");
        msg = {
            tag_id: message['tag_id'],
            rssi: message.rssi,
            id: id,
            weight: val.unpack(split(weight)).val / 100,
            _weight: val.unpack(split(weight)).val,
            date: moment(message.time * 1000).format(),
            receiver: message.receiver,
            type: "Weight",
            location: location,
            has_weight: true
        };
        $scope.messages.push(msg);
    }
    else {
        var status = "UNKNOWN";
        if ('vbat' in message['data'])
        {
            status="SWIPE_VBAT";
        }
        else if ('swipe' in message['data']) {
            status = "SWIPE";
        }

        msg = {
            tag_id: message['tag_id'],
            rssi: message.rssi,
            date: moment(message.time * 1000).format(),
            receiver: message.receiver,
            location: location,
            type: status
        };
        $scope.messages.push(msg);
    }

    $scope.$apply();
    return message;
}