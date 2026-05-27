import React, { useState } from "react";
import styled from "styled-components";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import ShareButtons from "./share";
const PropertyCard = ({
  image = [],
  price,
  name,
  location,
  rooms,
  area,
  operation,
  description,
  propertyId,
  contactNumber = "595982965447",
  contactEmail = "oficial@falconventas.com",
}) => {
  const [openChat, setOpenChat] = useState(false);
  const [date, setDate] = useState(new Date());

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

  const sendViaWhatsApp = () => {
    const message = `Hola, quisiera agendar una visita para el ${date.toLocaleDateString()} a la propiedad con id ${propertyId}, nombre: ${name}.`;
    window.open(
      `https://wa.me/${contactNumber}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const sendViaEmail = () => {
    const subject = "Solicitud de cita";
    const body = `Hola, quisiera agendar una visita para el ${date.toLocaleDateString()} a la propiedad con id: ${propertyId}, nombre: ${name}.`;
    window.open(
      `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    );
  };

  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
  };

  return (
    <Card>
      <ShareButtons
        propertyId={propertyId}
        name={name}
        location={location}
        price={price}
        contactNumber={contactNumber}
      />

      <Slider {...sliderSettings}>
        {image.map((img, index) => (
          <Image key={index} src={img} alt={`${name} - Imagen ${index + 1}`} />
        ))}
      </Slider>

      <PriceTag>${price}</PriceTag>
      <Details>
        <Title>{name}</Title>
        <Location>{location}</Location>
        <Description>{description}</Description>
        <Info>
          <span>{rooms} 🛏️</span>
          <span>{area} m²</span>
          <span>{operation}</span>
        </Info>
      </Details>

      <ChatButton onClick={() => setOpenChat(!openChat)}>💬</ChatButton>
      {openChat && (
        <ChatContainer>
          <ChatHeader>Información de Contacto</ChatHeader>
          <ChatBody>
            <button onClick={openGoogleMaps} style={{ marginBottom: "10px" }}>
              🌍 Ir a la Ubicación
            </button>
            <Calendario>
              <Calendar onChange={setDate} value={date} />
            </Calendario>
            <h4>Compartir Cita</h4>
            <button onClick={sendViaWhatsApp}>📲 WhatsApp</button>
            <button onClick={sendViaEmail}>📧 Email</button>
          </ChatBody>
          <ChatFooter>
            <ContactInfo>📞 Contacto: {contactNumber}</ContactInfo>
            <ContactInfo>📧 Email: {contactEmail}</ContactInfo>
          </ChatFooter>
        </ChatContainer>
      )}
    </Card>
  );
};

export default PropertyCard;

const Card = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  padding-bottom: 60px;
`;


const Image = styled.img`
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-bottom: 1px solid #ddd;
`;

const PriceTag = styled.div`
  font-size: 18px;
  font-weight: bold;
  padding: 15px;
`;

const Details = styled.div`
  padding: 10px;
`;

const Title = styled.h3`
  margin: 0;
`;

const Location = styled.p`
  font-size: 14px;
  color: gray;
`;

const Description = styled.p`
  font-size: 14px;
  color: #555;
  margin-top: 5px;
`;

const Info = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 14px;
`;

const ChatButton = styled.button`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #007bff;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
`;

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
  text-align: center;
`;

const ContactInfo = styled.p`
  margin: 0;
  font-size: 14px;
  color: #333;
`;
const Calendario = styled(Calendar)`
  background-color: #333; /* Fondo oscuro */
  color: white; /* Texto en blanco */
  border-radius: 8px;
  padding: 10px;

  /* Cambia el color del texto dentro del calendario */
  .react-calendar__tile {
    color: white !important;
  }

  /* Cambia el color de los días seleccionados o activos */
  .react-calendar__tile--active {
    background-color: #ff9800 !important; /* Naranja */
    color: black !important;
  }
`;
