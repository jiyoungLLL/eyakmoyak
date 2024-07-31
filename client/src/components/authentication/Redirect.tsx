import Cookies from 'js-cookie';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../api/api';
import { fetchUserInformation } from '../../api/authService';

const Redirect = ({ sns }: { sns: string }) => {
  const navigate = useNavigate();

  useEffect(() => {
    let url = '';
    switch (sns) {
      case 'kakao':
        url = 'api/auth/kakao/callback';
        break;
      case 'naver':
        url = 'api/auth/naver/callback';
        break;
      case 'google':
        url = 'api/auth/google/callback';
        break;
      default:
        console.error('알 수 없는 SNS');
        return;
    }

    const code = new URL(window.location.href).searchParams.get('code');

    if (code) {
      get(url, {
        code: code
      })
        .then((res) => {
          console.log(res);
          if (res.message === '로그인 성공') {
            Cookies.set('login', res.message);
            // 쿠키에 토큰 저장
            fetchUserInformation(() => {
              navigate('/', { replace: true });
              window.location.reload();
            });
          }
        })
        .catch((error) => {
          console.error('로그인 실패:', error);
          window.alert('로그인에 실패했습니다');
          navigate('/login');
        });
    } else {
      console.error('인증 코드 없음');
      navigate('/login');
    }
  }, [sns, , navigate]);

  return null;
};

export default Redirect;
