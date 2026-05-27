import { useState, useRef, useEffect } from "react"; 
import { Search } from "lucide-react";
import styled from "styled-components";

const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 12px;
  position: relative;
`;

const IconButton = styled.button`
  background: black;
  padding: 10px;
  border-radius: 50%;
  display: none;
  align-items: center;
  justify-content: center;
  color: white;
  border: none;
  cursor: pointer;

  @media (max-width: 768px) {
    display: flex;
  }
`;

const InputWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 400px;
  display: flex;
  align-items: center;
  border: 2px solid black;
  border-radius: 25px;
  padding: 5px;
  background: white;

  @media (max-width: 768px) {
    position: fixed;
    top: 8%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1003;
    display: ${({ isVisible }) => (isVisible ? "flex" : "none")};
    max-width: 90%;
    margin-top: 0;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 25px;
  font-size: 14px;
  color: #333;
  outline: none;
  background: transparent;

  @media (max-width: 480px) {
    font-size: 12px;
    padding: 8px;
  }
`;

const SearchButton = styled.button`
  background: black;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  border: none;
  cursor: pointer;
  margin-left: 8px;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: black;
  font-size: 20px;
  position: absolute;
  top: -40px;
  right: 10px;
  cursor: pointer;

  @media (min-width: 769px) {
    display: none;
  }
`;

const FiltersContainer = styled.div`
  display: ${({ isVisible }) => (isVisible ? "grid" : "none")};
  grid-template-columns: repeat(2, 1fr);
  gap: 25px;
  background: transparent;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
  width: 550px;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 10px;
  z-index: 1001;

  @media (max-width: 768px) {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 400px;
    grid-template-columns: 1fr;
    padding: 20px;
    background: transparent;
    border-radius: 20px;
    z-index: 1002;
  }
`;

const Backdrop = styled.div`
  display: ${({ isVisible }) => (isVisible ? "block" : "none")};
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;

  @media (min-width: 769px) {
    display: none;
  }
`;

const Select = styled.select`
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 14px;
`;

const InputNumber = styled.input`
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 14px;
  width: 100%;
`;

export default function SearchBar({ setFilters }) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtersRef = useRef(null);

  const [filters, setLocalFilters] = useState({
    type: "",
    rooms: "",
    transaction_fee: "",
    priceMin: "",
    priceMax: "",
    operation: "",
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleFilterChange = (e) => {
    setLocalFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = () => {
    setFilters(filters);
    // No cerrar el modal automáticamente
  };

  const closeModal = () => {
    setShowFilters(false);
    setMobileOpen(false);
  };

  return (
    <SearchContainer>
      <IconButton
        onClick={() => {
          setMobileOpen(true);
          setShowFilters(true);
        }}
      >
        <Search size={18} />
      </IconButton>

      <InputWrapper isVisible={mobileOpen || window.innerWidth > 768}>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (window.innerWidth > 768) setShowFilters(true);
          }}
          placeholder="Buscar..."
        />
        <SearchButton onClick={applyFilters}>
          <Search size={18} />
        </SearchButton>
        {mobileOpen && (
          <CloseButton onClick={closeModal}>X</CloseButton>
        )}
      </InputWrapper>

      <FiltersContainer ref={filtersRef} isVisible={showFilters}>
        <Select name="type" onChange={handleFilterChange}>
          <option value="">Tipo</option>
          <option value="Casa">Casa</option>
          <option value="Departamento">Departamento</option>
          <option value="Dúplex">Dúplex</option>
        </Select>

        <Select name="rooms" onChange={handleFilterChange}>
          <option value="">Habitaciones</option>
          <option value="1">1</option>
          <option value="2">2+</option>
        </Select>

        <Select name="transaction_fee" onChange={handleFilterChange}>
          <option value="">Tasa de Transacción</option>
          <option value="Baja">Baja</option>
          <option value="Media">Media</option>
          <option value="Alta">Alta</option>
        </Select>

        <InputNumber
          type="number"
          name="priceMin"
          placeholder="Precio mínimo"
          onChange={handleFilterChange}
        />
        <InputNumber
          type="number"
          name="priceMax"
          placeholder="Precio máximo"
          onChange={handleFilterChange}
        />

        <Select name="operation" onChange={handleFilterChange}>
          <option value="">Operación</option>
          <option value="Venta">Venta</option>
          <option value="Alquiler">Alquiler</option>
          <option value="Alquiler Temporal">Alquiler Temporal</option>
        </Select>
      </FiltersContainer>

      <Backdrop isVisible={mobileOpen} />
    </SearchContainer>
  );
}
