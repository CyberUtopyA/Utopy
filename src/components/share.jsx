import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { Facebook, Link, MessageCircle, Send, Twitter } from "lucide-react";

const ShareButtonsModal = ({ propertyId, name, location, price, contactNumber }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef();

  const shareOn = (platform) => {
    const url = window.location.href;
    const message = `🏡 Mira esta propiedad: ${name}\n📍Ubicación: ${location}\n💰Precio: $${price}\n📲 Contacto: ${contactNumber}\n🔗 ${url}`;
    let shareUrl = "";

    switch (platform) {
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
        break;
      case "telegram":
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
        break;
      case "copy":
        navigator.clipboard.writeText(`${message}`);
        alert("Enlace copiado al portapapeles");
        break;
      default:
        return;
    }

    if (platform !== "copy") {
      window.open(shareUrl, "_blank");
    }

    setIsFavorite(true);
    setShowModal(false);
  };

  // Cierra el modal al hacer clic afuera
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowModal(false);
      }
    };
    if (showModal) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showModal]);

  return (
    <>
      <ShareIconButton onClick={() => setShowModal(true)}>
        {isFavorite ? "❤️" : "🤍"}
      </ShareIconButton>

      {showModal && (
        <ModalOverlay>
          <ModalContent ref={modalRef}>
            <h3>Compartir propiedad</h3>
            <ShareOptions>
              <button onClick={() => shareOn("whatsapp")}>
                <MessageCircle size={20} /> WhatsApp
              </button>
              <button onClick={() => shareOn("facebook")}>
                <Facebook size={20} /> Facebook
              </button>
              <button onClick={() => shareOn("twitter")}>
                <Twitter size={20} /> Twitter
              </button>
              <button onClick={() => shareOn("telegram")}>
                <Send size={20} /> Telegram
              </button>
              <button onClick={() => shareOn("copy")}>
                <Link size={20} /> Copiar
              </button>
              <button onClick={() => setShowModal(false)}>❌ Cancelar</button>
            </ShareOptions>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

// ------------------------
// Styled Components
// ------------------------

const ShareIconButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  border-radius: 50%;
  border: none;
  padding: 6px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
  transition: transform 0.2s;
  &:hover {
    transform: scale(1.1);
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const ModalContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 12px;
  min-width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  h3 {
    margin-bottom: 16px;
    font-size: 18px;
    text-align: center;
  }
`;

const ShareOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 14px;
    border: none;
    border-radius: 6px;
    background-color:rgba(39, 39, 39, 0.67);
    cursor: pointer;
    transition: background-color 0.2s;
    &:hover {
      background-color: #e0e0e0;
    }
  }
`;

export default ShareButtonsModal;
