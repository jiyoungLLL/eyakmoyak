import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import PillAlarmChecker from './PillAlarmChecker';
import PillExpiredAlarmChecker from './PillExpiredAlarmChecker';

interface Icon {
  default: string;
  active: string;
}

interface NavItem {
  name: string;
  label: string;
  icon: Icon;
  style?: React.CSSProperties;
}

const Nav = () => {
  const navItems: NavItem[] = [
    {
      name: 'home',
      label: '홈',
      icon: {
        default: '/img/nav/home.png',
        active: '/img/nav/homeClicked.png'
      }
    },
    {
      name: 'chatbot',
      label: '상담',
      icon: {
        default: '/img/nav/talk.png',
        active: '/img/nav/talkClicked.png'
      },
      style: { color: 'FDE72E' }
    },
    {
      name: 'calendar',
      label: '캘린더',
      icon: {
        default: '/img/nav/calender.png',
        active: '/img/nav/calendarClicked.png'
      }
    },

    {
      name: 'alarm',
      label: '알람설정',
      icon: {
        default: '/img/nav/bell.svg',
        active: '/img/nav/bellClicked.png'
      },
      style: { marginLeft: '10px' }
    },
    {
      name: 'myPage',
      label: '마이페이지',
      icon: {
        default: '/img/nav/user.png',
        active: '/img/nav/userClicked.png'
      }
    }
  ];

  const { pathname: locationPathname } = useLocation();

  return (
    <NavContainer>
      <ul>
        {navItems.map((item) => {
          const { name, style, label, icon } = item;
          const isHomePage = name === 'home';
          const navPathname = isHomePage ? '/' : `/${name}`;
          const isActive =
            locationPathname !== '/'
              ? !isHomePage && locationPathname.startsWith(navPathname)
              : isHomePage;
          const iconSrc = !isActive ? icon.default : icon.active;

          return (
            <li key={name} style={style}>
              <StyledLink to={navPathname}>
                <img src={iconSrc} alt={label} />
                <p>{label}</p>
              </StyledLink>
            </li>
          );
        })}
      </ul>
      <PillAlarmChecker />
      <PillExpiredAlarmChecker />
    </NavContainer>
  );
};
export default Nav;

const NavContainer = styled.nav`
  position: fixed;
  z-index: 10;
  bottom: 0;
  width: 100vw;
  height: 80px;
  background-color: #ffffff;
  & ul {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    margin: auto;
    padding: 0;
    height: 100%;
    & li {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      list-style: none;
      &:hover {
        cursor: pointer;
        & img {
          filter: var(--main-color);
        }
        & p {
          color: var(--main-color);
        }
      }
    }
    & img {
      width: 35px;
    }
    & p {
      margin: 0;
      color: #c6c6c6;
      font-size: 12px;
      font-weight: bold;
    }
  }
`;

const StyledLink = styled(Link)`
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
`;
