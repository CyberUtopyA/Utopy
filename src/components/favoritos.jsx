import React from 'react';
import styled from 'styled-components';
import PropertyCard from './card';

const FavoritesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
  position: relative;
  z-index: 9999; /* Asegura que esté en la capa superior */
`;

const Title = styled.h2`
  text-align: center;
  color: #333;
`;

const FavoriteProperties = ({ favoriteList = [] }) => {
  return (
    <div>
      <FavoritesContainer>
        <Title>Mis Propiedades Favoritas ❤️</Title>
        {favoriteList.length > 0 ? (
          favoriteList.map((property) => (
            <PropertyCard key={property.id} {...property} />
          ))
        ) : (
          <p>No tienes propiedades favoritas aún.</p>
        )}
      </FavoritesContainer>
    </div>
  );
};

export default FavoriteProperties;
