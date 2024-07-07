import React, {useEffect, useState} from 'react';
import {FlatList, Platform, Switch, Text, View} from 'react-native';
import BackgroundGeolocation, {
  GeofenceEvent,
  Location,
} from 'react-native-background-geolocation';
import haversine from 'haversine';
import {isWithinRange} from './helpers';
import {AndroidStationCoordinates, IOSStationCoordinates} from './constants';

export const Geofencing = () => {
  const [enabled, setEnabled] = useState(false);
  const [location, setLocation] = React.useState('');
  const [geofenceEvent, setGeofenceEvent] = React.useState<GeofenceEvent>(null);

  const [pings, setPings] = useState<
    {
      stationId: string;
      action: 'entry' | 'exit';
      lat: number;
      long: number;
      haversineDistance: number;
    }[]
  >([]);

  const stationCoordinates =
    Platform.OS === 'ios' ? IOSStationCoordinates : AndroidStationCoordinates;
  const geofences = stationCoordinates.map(eachCordinate => {
    return {
      identifier: eachCordinate.id,
      radius: 200,
      latitude: eachCordinate.latitude,
      longitude: eachCordinate.longitude,
      notifyOnEntry: true,
      notifyOnExit: true,
    };
  });

  const onGeofence = () => {
    const location: Location = geofenceEvent.location;
    const marker = geofences.find((m: any) => {
      return m.identifier === geofenceEvent.identifier;
    });

    if (!marker) {
      console.log('Error: Geofence not found');
      return;
    }

    const haversinDistance = haversine(
      {
        latitude: marker.latitude,
        longitude: marker.longitude,
      },
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      {unit: 'meter'},
    );

    const isGeofencingCorrect = isWithinRange(haversinDistance, 200, 50);

    if (geofenceEvent.action === 'ENTER') {
      console.log('✅✅ Geofence Enter', marker.identifier);
      setPings(prevPings => [
        ...prevPings,
        {
          stationId: marker.identifier,
          action: 'entry',
          lat: location.coords.latitude,
          long: location.coords.longitude,
          haversineDistance: haversinDistance,
        },
      ]);
    } else if (geofenceEvent.action === 'EXIT') {
      console.log('❌❌ Geofence Exit', marker.identifier);
      setPings(prevPings => [
        ...prevPings,
        {
          stationId: marker.identifier,
          action: 'exit',
          lat: location.coords.latitude,
          long: location.coords.longitude,
          haversineDistance: haversinDistance,
        },
      ]);
    }
    console.log(
      'Cordinates - lat,long',
      location.coords.latitude,
      location.coords.longitude,
    );
    console.log(
      'haversine distance should be close to 200 m',
      haversinDistance,
    );
  };

  useEffect(() => {
    if (!geofenceEvent) {
      return;
    }
    onGeofence();
  }, [geofenceEvent]);

  /// Collection of BackgroundGeolocation event-subscriptions.
  const subscriptions: any[] = [];

  /// [Helper] Add a BackgroundGeolocation event subscription to collection
  const subscribe = (subscription: any) => {
    subscriptions.push(subscription);
  };

  /// [Helper] Iterate BackgroundGeolocation subscriptions and .remove() each.
  const unsubscribe = () => {
    subscriptions.forEach((subscription: any) => subscription.remove());
    subscriptions.splice(0, subscriptions.length);
  };

  useEffect(() => {
    /// 1.  Subscribe to events.
    console.log('subscribing to events');
    subscribe(
      BackgroundGeolocation.onLocation(location => {
        console.log(
          '[onLocation]',
          location?.coords?.latitude,
          location?.coords?.longitude,
        );
        setLocation(JSON.stringify(location, null, 2));
      }),
    );

    subscribe(
      BackgroundGeolocation.onMotionChange(event => {
        // console.log('[onMotionChange]', event);
      }),
    );

    subscribe(
      BackgroundGeolocation.onGeofence(event => {
        console.log('event', event);
        setGeofenceEvent(event);
      }),
    );

    subscribe(
      BackgroundGeolocation.onActivityChange(event => {
        // console.log('[onActivityChange]', event);
      }),
    );

    subscribe(
      BackgroundGeolocation.onProviderChange(event => {
        // console.log('[onProviderChange]', event);
      }),
    );

    /// 2. ready the plugin.
    console.log('Making BackgroundGeolocation ready with config');

    BackgroundGeolocation.ready({
      reset: false,
      // Geolocation Config
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,
      // Activity Recognition
      stopTimeout: 5,
      locationAuthorizationRequest: 'Always',
      backgroundPermissionRationale: {
        title:
          "Allow {applicationName} to access this device's location even when closed or not in use.",
        message:
          'We require your location even when app is closed or not in use to recommend you offers based on places you visit.',
        positiveAction: 'Change to "{backgroundPermissionOptionLabel}"',
        negativeAction: 'Cancel',
      },
      // Application config
      debug: true, // <-- enable this hear sounds for background-geolocation life-cycle.
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      stopOnTerminate: false, // <-- Allow the background-service to continue tracking when user closes the app.
      startOnBoot: true, // <-- Auto start tracking when device is powered-up.,
      enableHeadless: true,
      preventSuspend: true,
      pausesLocationUpdatesAutomatically: false,
      // HTTP / SQLite config
      //url: 'http://yourserver.com/locations',
      batchSync: false, // <-- [Default: false] Set true to sync locations to server in a single HTTP request.
      autoSync: true, // <-- [Default: true] Set true to sync each location to server as it arrives.
      //preventSuspend: true,
      geofenceInitialTriggerEntry: true,
    }).then(state => {
      console.log('Adding geofence for all stations with 200 m radius');
      BackgroundGeolocation.addGeofences(geofences)
        .then(() => {
          console.log('Success: Geofence created for station1');
        })
        .catch(error => {
          console.log('Error: Error while creating geofences');
        });
      setEnabled(state.enabled);
      console.log(
        '- BackgroundGeolocation is configured and ready: ',
        state.enabled,
      );
    });

    return () => {
      // Remove BackgroundGeolocation event-subscribers when the View is removed or refreshed
      // during development live-reload.  Without this, event-listeners will accumulate with
      // each refresh during live-reload.
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (enabled) {
      BackgroundGeolocation.start();
    } else {
      console.log('STOPPING');
      BackgroundGeolocation.stop();
      setLocation('');
    }
  }, [enabled]);

  return (
    <View>
      <View
        style={{
          marginTop: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginHorizontal: 24,
        }}>
        <Text> Enable Geofencing </Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>
      <View
        style={{
          marginTop: 30,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginHorizontal: 24,
        }}>
        <Text> User's location </Text>
        <Text>{location}</Text>
      </View>
      <FlatList
        data={pings}
        renderItem={({item}) => (
          <View
            style={{marginBottom: 15, borderWidth: 1, borderColor: 'black'}}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text>Action</Text>
              <Text>{item.action}</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text>Station ID</Text>
              <Text>{item.stationId}</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text>Lattitude</Text>
              <Text>{item.lat}</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text>Longitude</Text>
              <Text>{item.long}</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text>Haversine Distance</Text>
              <Text>{item.haversineDistance}</Text>
            </View>
          </View>
        )}
        keyExtractor={item => item.stationId + item.action}
      />
    </View>
  );
};
