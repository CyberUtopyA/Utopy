import React, { useState } from "react";
import styled from "styled-components";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const ChatContainer = styled.div`
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 300px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  z-index: 1003;
  display: ${(props) => (props.open ? "block" : "none")};
`;

const ChatHeader = styled.div`
  background: #007bff;
  color: white;
  padding: 10px;
  text-align: center;
  font-weight: bold;
`;

const ChatBody = styled.div`
  padding: 10px;
  height: 250px;
  overflow-y: auto;
`;

const ChatFooter = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ChatButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #007bff;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
`;

const ContactInfo = styled.p`
  margin: 0;
  font-size: 14px;
  color: #333;
`;

const ChatComponent = ({ location }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  
  const contactNumber = "0982965447";
  const contactEmail = "oficial@falconventas.com";

  // Abrir Google Maps con la ubicación
  const openGoogleMaps = () => {
    if (location) {
      window.open(
        `https://www.google.com/maps?q=${encodeURIComponent(location)}`,
        "_blank"
      );
    } else {
      alert("Ubicación no disponible");
    }
  };

  // Enviar cita por WhatsApp
  const sendViaWhatsApp = () => {
    const message = `Hola, quisiera agendar una visita para el ${date.toLocaleDateString()}.`;
    window.open(
      `https://wa.me/${contactNumber}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  // Enviar cita por correo
  const sendViaEmail = () => {
    const subject = "Solicitud de cita";
    const body = `Hola, quisiera agendar una visita para el ${date.toLocaleDateString()}.`;
    window.open(
      `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    );
  };

  return (
    <>
      <ChatButton onClick={() => setOpen(!open)}>💬</ChatButton>

      <ChatContainer open={open}>
        <ChatHeader>Información de Contacto</ChatHeader>

        <ChatBody>
          {/* Botón para abrir Google Maps */}
          <button onClick={openGoogleMaps} style={{ marginBottom: "10px" }}>
            🌍 Ir a la Ubicación
          </button>

          {/* Calendario para seleccionar la fecha */}
          <Calendar onChange={setDate} value={date} />

          {/* Opciones de compartir la cita */}
          <h4>Compartir Cita</h4>
          <button onClick={sendViaWhatsApp}>📲 WhatsApp</button>
          <button onClick={sendViaEmail}>📧 Email</button>
        </ChatBody>

        <ChatFooter>
          <ContactInfo>📞 Contacto: {contactNumber}</ContactInfo>
          <ContactInfo>📧 Email: {contactEmail}</ContactInfo>
        </ChatFooter>
      </ChatContainer>
    </>
  );
};

export default ChatComponent;
