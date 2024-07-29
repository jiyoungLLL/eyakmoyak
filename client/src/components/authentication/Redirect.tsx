import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../api/api';
import { useUserStore } from '../../store/user';

const Redirect = ({ sns }: { sns: string }) => {
  const { setToken } = useUserStore();
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
          if (res.token) {
            setToken(res.token, res.refreshToken);
            navigate('/');
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
