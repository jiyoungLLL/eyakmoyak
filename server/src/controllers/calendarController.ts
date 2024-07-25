import { Response, NextFunction } from 'express';
import { CustomRequest } from '../types/express.d';
import { Calendar } from '../entity/calendar';
import * as calendarService from '../services/calendarService';
import { uploadToS3 } from '../config/imgUploads';

export const getAllCalendars = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.email;
    const calendars: Calendar[] = await calendarService.getAllCalendars(userId);
    res.status(200).json(calendars);
  } catch (error) {
    next(error);
  }
};

export const getCalendarById =  async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const calendar: Calendar | null = await calendarService.getCalendarById(id);
    if (calendar) {
      res.status(200).json(calendar);
    } else {
      res.status(404).json({ message: 'Calendar not found' });
    }
  } catch (error) {
    next(error);
  }
};

export const createCalendar = [
  uploadToS3.single('calImg'),
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.email;
      console.log('req.user', req.user);
      const calImgUrl = req.file ? (req.file as any).location : null;

      const date = req.body.date ? new Date(req.body.date) : new Date();
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: '유효하지 않은 날짜 형식입니다.' });
      }
      
      const medications = req.body.medications ? JSON.parse(req.body.medications) : [];
      
      const calendarData: Partial<Calendar> = {
        userId,
        calImg: calImgUrl,
        date: date,
        condition: req.body.condition,
        weight: req.body.weight ? parseFloat(req.body.weight) : undefined,
        temperature: req.body.temperature ? parseFloat(req.body.temperature) : undefined,
        bloodsugarBefore: req.body.bloodsugarBefore ? parseFloat(req.body.bloodsugarBefore) : undefined,
        bloodsugarAfter: req.body.bloodsugarAfter ? parseFloat(req.body.bloodsugarAfter) : undefined,
        medications: medications
      };

      console.log("Processed calendarData:", calendarData);

      if (!calendarData.calImg) {
        return res.status(400).json({ message: 'calImg is required' });
      }

      const newCalendar: Calendar = await calendarService.createCalendar(calendarData as Omit<Calendar, 'id'>);
      res.status(201).json(newCalendar);
    } catch (error) {
      console.error("Error in createCalendar:", error);
      next(error);
    }
  } 
];

export const updateCalendar  = [
  uploadToS3.single('calImg'),
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    console.log('Update request body:', req.body);
    console.log('Update request files:', req.files);
    try {
      const { id } = req.params;
      const calImgUrl = req.file ? (req.file as any).location : null;
      
      const medications = JSON.parse(req.body.medications ?? '[]');
      
      const calendarData: Partial<Calendar> = {
        ...req.body,
        calImg: calImgUrl,
        condition: req.body.condition,
        date: req.body.date ? new Date(req.body.date) : undefined,
        weight: req.body.weight ? parseFloat(req.body.weight) : undefined,
        temperature: req.body.temperature ? parseFloat(req.body.temperature) : undefined,
        bloodsugarBefore: req.body.bloodsugarBefore ? parseFloat(req.body.bloodsugarBefore) : undefined,
        bloodsugarAfter: req.body.bloodsugarAfter ? parseFloat(req.body.bloodsugarAfter) : undefined,
        medications: medications
      };
      const updatedCalendar: Calendar | null = await calendarService.updateCalendar(id, calendarData);
      if (updatedCalendar) {
        res.status(200).json(updatedCalendar);
      } else {
        res.status(404).json({ message: 'Calendar not found' });
      }
    } catch (error) {
      next(error);
    }
  }
];


export const deleteCalendar = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.email;
    const { id } = req.params;
    const success: boolean = await calendarService.deleteCalendar(id);
    if (success) {
      res.status(200).json({ message: 'Calendar deleted successfully' });
    } else {
      res.status(404).json({ message: 'Calendar not found' });
    }
  } catch (error) {
    next(error);
  }
};

