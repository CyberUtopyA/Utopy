import React, { useState } from 'react';

export default function Diseño2D() {
  const [fileName, setFileName] = useState('');
  const [clothingType, setClothingType] = useState('');
  const [material, setMaterial] = useState('');

  const handleFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
    }
  };

  const handleClothingTypeChange = (event) => {
    setClothingType(event.target.value);
  };

  const handleMaterialChange = (event) => {
    setMaterial(event.target.value);
  };


  return (
    <div>

      <label htmlFor="file">Subir vestimenta personalizada:</label>
      <input type="file" id="file" accept=".png,.jpg,.jpeg,.pdf" onChange={handleFile} />

      {fileName && <p>Archivo seleccionado: {fileName}</p>}

      <label htmlFor="clothingType">Tipo de ropa:</label>
      <select id="clothingType" value={clothingType} onChange={handleClothingTypeChange}>
        <option value="">Seleccionar...</option>
        <option value="pantalon">Pantalón</option>
        <option value="remera">Remera</option>
        <option value="otro">Otro</option>
      </select>

      <label htmlFor="material">Material:</label>
      <input
        type="text"
        id="material"
        placeholder="Especificar material"
        value={material}
        onChange={handleMaterialChange}
      />

      {clothingType && <p>Tipo de ropa seleccionado: {clothingType}</p>}
      {material && <p>Material especificado: {material}</p>}

    </div>
  );
}
