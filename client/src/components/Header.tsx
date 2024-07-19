/**
 * File Name : Header
 * Description : 좌측 상단의 작은 로고 구현
 * Author : 민선옥
 *
 * History
 * Date        Author   Status    Description
 * 2024.07.16  민선옥   Created
 * 2024.07.18  임지영   Modified    tsx
 */

import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background-color: #ffffff;
  padding: 15px;
  padding-bottom: 8px;
`;

const Logo = styled.img`
  height: 40px;
`;

const Header: React.FC = () => {
  return (
    <HeaderContainer>
      <Logo src={`/img/logo_not_chicken.svg`} alt='Logo' />
    </HeaderContainer>
  );
};

export default Header;
