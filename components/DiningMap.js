import MapView, { Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native';

export default function DiningMap({ region, diningHalls, suggestion }) {
  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      showsUserLocation={true}
    >
      {diningHalls.map((hall) => {
        if (!hall.coordinates?.latitude) return null;

        const isSuggested = suggestion && hall.id === suggestion.id;
        const pinColor = isSuggested ? "blue" : (hall.status.isOpen ? "green" : "red");

        return (
          <Marker
            key={hall.id}
            coordinate={hall.coordinates}
            pinColor={pinColor}
            title={hall.name}
            description={hall.status.isOpen ? "Open Now" : "Closed"}
          />
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
});
