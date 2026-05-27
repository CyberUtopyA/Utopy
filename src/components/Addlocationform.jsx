const AddLocationForm = ({ onAddLocation }) => {
    const [formState, setFormState] = useState({ name: "", latitude: "", longitude: "" });
  
    const handleSubmit = (e) => {
      e.preventDefault();
      onAddLocation(formState);
      setFormState({ name: "", latitude: "", longitude: "" });
    };
  
    return (
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre del activo"
          value={formState.name}
          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Latitud"
          value={formState.latitude}
          onChange={(e) => setFormState({ ...formState, latitude: e.target.value })}
        />
        <input
          type="number"
          placeholder="Longitud"
          value={formState.longitude}
          onChange={(e) => setFormState({ ...formState, longitude: e.target.value })}
        />
        <button type="submit">Agregar ubicación</button>
      </form>
    );
  };
  