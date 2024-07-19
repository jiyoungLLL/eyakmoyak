const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createError } = require('../utils/error');
const { pool } = require('../db');
const dotenv = require('dotenv');
const axios = require('axios');
const nodemailer = require('nodemailer');

dotenv.config();

// 이메일 전송 설정
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// User 인터페이스
interface User {
  id: number;
  email: string;
  username: string;
  password: string;
  kakaoid?: string;
}

// User 응답 (password 필드 없음)
interface UserResponse {
  email: string;
  username: string;
}

// 로그인
exports.loginService = async (email: string, password: string): Promise<{ token: string; refreshToken: string }> => {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM users WHERE email = $1';
    const values = [email];
    const result = await client.query(query, values);
    const user = result.rows[0];

    if (!user) {
      throw createError('UserNotFound', '사용자를 찾을 수 없습니다.', 404);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw createError('InvalidCredentials', '비밀번호가 틀렸습니다.', 401);
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET_KEY, { expiresIn: '7d' });

    return { token, refreshToken };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

// 회원가입
exports.signupService = async (email: string, username: string, password: string, confirmPassword: string): Promise<UserResponse> => {
  const client = await pool.connect();
  try {
    const checkUserQuery = 'SELECT * FROM users WHERE email = $1';
    const checkUserValues = [email];
    const existingUserResult = await client.query(checkUserQuery, checkUserValues);

    if (existingUserResult.rows.length > 0) {
      throw createError('UserExists', '해당 이메일로 이미 사용자가 존재합니다.', 409);
    }

    if (password !== confirmPassword) {
      throw createError('PasswordMismatch', '비밀번호가 일치하지 않습니다.', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertUserQuery = `
      INSERT INTO users (email, username, password, role) VALUES ($1, $2, $3, $4)
      RETURNING email, username
    `;
    const insertUserValues = [email, username, hashedPassword, false];
    const newUserResult = await client.query(insertUserQuery, insertUserValues);
    const newUser = newUserResult.rows[0];

    return { email: newUser.email, username: newUser.username };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

// 토큰 갱신
exports.refreshTokenService = async (refreshToken: string): Promise<string> => {
  if (!refreshToken) {
    throw createError('NoRefreshToken', '토큰이 없습니다.', 401);
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET_KEY);
  } catch (error) {
    throw createError('InvalidRefreshToken', '유효하지 않은 토큰입니다.', 403);
  }

  const newToken = jwt.sign({ id: (payload as any).id, email: (payload as any).email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return newToken;
};

// 카카오 인증 (로그인 및 회원가입)
exports.kakaoAuthService = async (code: string): Promise<{ token: string; refreshToken: string }> => {
  const redirectUri = 'http://localhost:3000/auth/kakao/callback';
  const kakaoTokenUrl = `https://kauth.kakao.com/oauth/token`;

  try {
    const tokenResponse = await axios.post(kakaoTokenUrl, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: redirectUri,
        code,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token } = tokenResponse.data;

    const userInfoResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    const { id, kakao_account, properties } = userInfoResponse.data;
    const email = kakao_account.email || null;
    const username = properties.nickname || kakao_account.profile.nickname || null;

    // 이메일없는 경우
    if (!email) {
      throw createError('KakaoAuthError', '카카오에서 사용자 정보가 충분하지 않습니다.', 400);
    }

    // 사용자 정보 DB에 저장 및 JWT 발급
    const client = await pool.connect();
    try {
      const checkUserQuery = 'SELECT * FROM users WHERE kakaoid = $1';
      const checkUserValues = [id];
      const existingUserResult = await client.query(checkUserQuery, checkUserValues);

      let user;
      if (existingUserResult.rows.length > 0) {
        user = existingUserResult.rows[0];
      } else {
        const insertUserQuery = `
          INSERT INTO users (email, username, password, role, kakaoid) VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const insertUserValues = [email, username, 'kakao_auth_password', false, id];
        const newUserResult = await client.query(insertUserQuery, insertUserValues);
        user = newUserResult.rows[0];
      }

      const payload = { id: user.id, email: user.email };
      const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });
      const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET_KEY, { expiresIn: '7d' });

      return { token, refreshToken };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Kakao authentication error:', error);
    throw createError('KakaoAuthError', '카카오 인증 실패', 500);
  }
};

// 비번 변경
exports.changePasswordService = async (email: string, oldPassword: string, newPassword: string): Promise<void> => {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM users WHERE email = $1';
    const values = [email];
    const result = await client.query(query, values);
    const user = result.rows[0];

    if (!user) {
      throw createError('UserNotFound', '사용자를 찾을 수 없습니다.', 404);
    }
    if (user.kakaoid) {
      throw createError('SocialUserError', '소셜 로그인 사용자는 비밀번호를 변경할 수 없습니다.', 400);
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      throw createError('InvalidCredentials', '기존 비밀번호가 틀렸습니다.', 401);
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = 'UPDATE users SET password = $1 WHERE email = $2';
    const updateValues = [hashedNewPassword, email];
    await client.query(updateQuery, updateValues);
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};


// 비번 재설정 요청
exports.requestPasswordService = async (email: string): Promise<void> => {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM users WHERE email = $1';
    const values = [email];
    const result = await client.query(query, values);
    const user = result.rows[0];

    if (!user) {
      throw createError('User Not Found', '사용자를 찾을 수 없습니다', 404);
    }

    const token = jwt.sign({ id: user.userid, email: user.email }, process.env.SECRET_KEY, { expiresIn: '20m'});
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '비밀번호 재설정',
      text: `비밀번호를 재설정하려면 링크를 클릭하세요 (유효시간: 3분): http://localhost:3000/reset-password?token=${token}`,
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

// 비번 재설정
exports.resetPasswordService = async (token: string, newPassword: string): Promise<void> => {
  try {
    const decoded: any = jwt.verify(token, process.env.SECRET_KEY);
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users WHERE userid = $1';
      const values = [decoded.id];
      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw createError('UserNotFound', '사용자를 찾을 수 없습니다', 404);
      }

      const user = result.rows[0];

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      const updateQuery = 'UPDATE users SET password = $1 WHERE userid = $2';
      const updateValues = [hashedNewPassword, decoded.id];
      await client.query(updateQuery, updateValues);
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw createError('TokenExpired', '토큰이 만료되었습니다.', 400);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('InvalidToken', '유효하지 않은 토큰입니다.', 400);
    }
    throw error;
  }
};
