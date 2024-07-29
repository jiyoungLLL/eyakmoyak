import styled from 'styled-components';
import DetailTextBox from './DetailTextBox';
import { calendarGet, calendarPost } from '../../api/calendarApi';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { useDateStore, useCalendar } from '../../store/store';
import { calendarPut } from '../../api/calendarApi';

interface CalendarData {
  medications?: {
    name?: string;
    time?: string[];
    taken?: boolean[];
  }[];
  bloodsugarbefore?: number;
  bloodsugarafter?: number;
  temperature?: number;
  weight?: number;
  calimg?: string;
}

const OpenCalendarDetail: React.FC = () => {
  const { pillData, bloodsugarbefore, bloodsugarafter, temp, weight, photo } =
    useCalendar();
  const { value, edit, neverPost, setNeverPost } = useDateStore();
  const formattedDate = dayjs(value).format('YYYY-MM-DD');
  const [data, setData] = useState<CalendarData | null>(null);

  useEffect(() => {
    const data = {
      date: formattedDate,
      bloodsugarBefore: bloodsugarbefore,
      bloodsugarAfter: bloodsugarafter,
      medications: JSON.stringify(pillData),
      temperature: temp,
      weight: weight,
      calimg: photo
    };

    const putData = async () => {
      // 기존 데이터 있을 때
      if (!edit && !neverPost) {
        try {
          const res = await calendarPut(formattedDate, data);
          setData(res);
          console.log('일정 수정 성공:', res);
        } catch (err) {
          console.error('일정 수정 오류:', err);
        }
      } // 없을 때
      else if (!edit && neverPost) {
        try {
          const res = await calendarPost(data);
          setData(res);
          console.log('일정 등록 성공', res);
          setNeverPost(false);
        } catch (err) {
          console.log('일정 등록 실패', err);
        }
      }
    };

    putData();
  }, [edit]);

  useEffect(() => {
    if (formattedDate !== undefined) {
      const fetchPillData = async () => {
        try {
          const data = await calendarGet(formattedDate);
          console.log(data);
          setData(data);
          setNeverPost(false);

          if (data === undefined) {
            setNeverPost(true);
          }
        } catch (err) {
          console.log('해당하는 약복용여부 정보 없음', err);
        }
      };

      fetchPillData();
    }
  }, [formattedDate, edit]);

  return (
    <ContentContainer>
      <DetailTextBox title='약 복용 여부' pillData={data?.medications} />
      <DetailTextBox
        title='혈당'
        bloodsugarbefore={data?.bloodsugarbefore}
        bloodsugarafter={data?.bloodsugarafter}
      />
      <DetailTextBox title='체온' temp={data?.temperature} />
      <DetailTextBox title='체중' weight={data?.weight} />
      <DetailTextBox title='사진 기록' photo={data?.calimg} />
    </ContentContainer>
  );
};

const ContentContainer = styled.div``;

export default OpenCalendarDetail;
