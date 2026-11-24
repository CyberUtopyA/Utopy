// src/components/sidebar.jsx
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import styled from "styled-components";

function Sidebar() {
  const navigate = useNavigate();

  const handleUserClick = () => {
    navigate("/market?account=1");
  };

  return (
    <SidebarContainer>
      <UserSection type="button" onClick={handleUserClick} title="Mi cuenta" aria-label="Mi cuenta">
        <UserCircle>
          <User size={18} color="#374151" />
        </UserCircle>
      </UserSection>

      <BottomSection onClick={() => navigate(-1)} title="Volver">
        <ArrowLeft size={20} />
      </BottomSection>
    </SidebarContainer>
  );
}

const SidebarContainer = styled.div`
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  width: 56px;
  height: 120px;
  padding: 0.5rem;
  background-color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    width: 44px;
    height: 110px;
    padding: 0.4rem;
    border-radius: 12px;
  }
`;

const UserCircle = styled.div`
  width: 32px;
  height: 32px;
  background-color: #d1d5db;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  display: flex;
  justify-content: center;
  align-items: center;

  @media (max-width: 768px) {
    width: 26px;
    height: 26px;
  }
`;

const BottomSection = styled.div`
  cursor: pointer;
  color: #374151;

  svg {
    width: 20px;
    height: 20px;

    @media (max-width: 768px) {
      width: 16px;
      height: 16px;
    }
  }
`;

const UserSection = styled.button`
  border:0;
  background:transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;

  @media (max-width: 768px) {
    gap: 0.3rem;
  }
`;

export default Sidebar;
