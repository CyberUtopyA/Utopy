import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropertyForm from "../components/formulario";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const orbitLeft = keyframes`
  0% { transform: translateX(0) rotate(0deg); }
  100% { transform: translateX(-150px) rotate(360deg); }
`;

const orbitRight = keyframes`
  0% { transform: translateX(0) rotate(0deg); }
  100% { transform: translateX(150px) rotate(-360deg); }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  animation: ${fadeIn} 0.5s ease-out;
`;

const ModalContent = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Option = styled.div`
  position: absolute;
  cursor: pointer;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.3s ease, background 0.3s ease;
  z-index: 2;

  &:hover {
    background: rgba(255, 255, 255, 0.4);
    transform: scale(1.1);
  }

  &.left {
    animation: ${orbitLeft} 10s linear infinite;
  }

  &.right {
    animation: ${orbitRight} 10s linear infinite;
  }
`;

const OptionImage = styled.img`
  width: 60%;
  height: 60%;
  object-fit: contain;
`;

const MainImage = styled.img`
  width: 200px;
  height: 200px;
  object-fit: contain;
`;

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const FormContent = styled.div`
  position: relative;
  width: min(95vw, 760px);
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 24px;
  background: rgba(10, 15, 30, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.55);
  padding: 18px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 3;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const FavoriteBox = styled.div`
  color: white;
  text-align: center;
  padding: 40px 20px;
`;

type Props = {
  onClose: () => void;
};

const MetaverseModal = ({ onClose }: Props) => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"favorito" | "add" | null>(
    null
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleOptionClick = (option: "favorito" | "add") => {
    setSelectedOption(option);
  };

  if (!isVisible) return null;

  return (
    <>
      <ModalOverlay onClick={onClose}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <Option className="left" onClick={() => handleOptionClick("favorito")}>
            <OptionImage src="/corazon.png" alt="favorito" />
          </Option>

          <MainImage src="/realestates.png" alt="Metaverse" />

          <Option className="right" onClick={() => handleOptionClick("add")}>
            <OptionImage src="/mas.png" alt="Agregar propiedad" />
          </Option>
        </ModalContent>
      </ModalOverlay>

      {selectedOption === "favorito" && (
        <FormOverlay onClick={() => setSelectedOption(null)}>
          <FormContent onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={() => setSelectedOption(null)}>×</CloseButton>
            <FavoriteBox>
              <h2>Favoritos</h2>
              <p>Todavía no hay propiedades favoritas.</p>
            </FavoriteBox>
          </FormContent>
        </FormOverlay>
      )}

      {selectedOption === "add" && (
        <FormOverlay onClick={() => setSelectedOption(null)}>
          <FormContent onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={() => setSelectedOption(null)}>×</CloseButton>
            <PropertyForm onClose={() => setSelectedOption(null)} />
          </FormContent>
        </FormOverlay>
      )}
    </>
  );
};

export default MetaverseModal;