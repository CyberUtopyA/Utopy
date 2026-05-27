import React, { useEffect, useState } from "react";
import { ViroARScene, ViroARImageMarker, ViroText } from "react-viro";

const ARComponent = ({ assets }) => {
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => console.error(error),
      { enableHighAccuracy: true }
    );
  }, []);

  if (!userLocation) return <p>Loading AR view...</p>;

  return (
    <ViroARScene>
      {assets.map((asset) => (
        <ViroARImageMarker
          key={asset.id}
          target={asset.name}
          position={[
            asset.latitude - userLocation.latitude,
            0,
            asset.longitude - userLocation.longitude,
          ]}
        >
          <ViroText text={asset.name} scale={[0.5, 0.5, 0.5]} />
        </ViroARImageMarker>
      ))}
    </ViroARScene>
  );
};

export default ARComponent;
