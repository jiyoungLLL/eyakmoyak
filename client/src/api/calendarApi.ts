import { del, get, post, put } from './api';

// 사용자 일정 전체보기
export const calendarAllGet = async () => {
  try {
    const res = await get('/api/calendars');
    return res;
  } catch (err) {}
};

// 일정 상세보기
export const calendarGet = async (date: string) => {
  try {
    const res = await get(`/api/calendars/${date}`);
    return res;
  } catch (err) {}
};

export const calendarPost = async (requestBody: object) => {
  try {
    const res = await post('/api/calendars', requestBody);
    return res;
  } catch (err) {}
};

export const calendarPut = async (date: string, requestBody: FormData) => {
  try {
    const res = await put(`/api/calendars/${date}`, requestBody);
    return res;
  } catch (err) {}
};

export const calendarDelete = async (date: string) => {
  try {
    const res = await del(`/api/calendars/${date}`);
    return res;
  } catch (err) {}
};
