import { pool } from '../db';
import { createError } from '../utils/error';
import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

interface PillData {
  id: number;
  name: string;
  front: string;
  back: string;
  shape: string;
  imagepath: string;
  favoriteCount: number;
}

interface GetPillsResult {
  totalCount: number;
  totalPages: number;
  data: PillData[];
}

interface SearchResult {
  pills: PillData[];
  total: number;
  limit: number;
  offset: number;
}

export const getPills = async (
  limit: number,
  offset: number,
  sortedBy: string,
  order: string
): Promise<GetPillsResult> => {
  const countQuery = `SELECT COUNT(*) AS total FROM pills`;
  const countResults = await pool.query(countQuery);
  const totalCount = parseInt(countResults.rows[0].total, 10);
  const totalPages = Math.ceil(totalCount / limit);

  const query = `
    SELECT pills.*, COALESCE(favorite_counts.count, 0) as favorite_count
    FROM pills
    LEFT JOIN (
      SELECT id, COUNT(*) AS count
      FROM favorites
      GROUP BY id
    ) AS favorite_counts ON pills.id = favorite_counts.id
    ORDER BY ${
      sortedBy === 'favorite_count' ? 'favorite_count' : `pills.${sortedBy}`
    } ${order}
    LIMIT $1 OFFSET $2`;

  const values = [limit, offset];
  const { rows } = await pool.query(query, values);

  return {
    totalCount,
    totalPages,
    data: rows,
  };
};

export const getPillById = async (id: number): Promise<PillData | null> => {
  const query = 'SELECT * FROM pills WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

export const searchPillsbyName = async (
  name: string,
  limit: number,
  offset: number,
  searchBy: 'name' | 'engname'
): Promise<SearchResult> => {
  const query = `SELECT * FROM pills WHERE ${searchBy} ILIKE $1 LIMIT $2 OFFSET $3`;
  const values = [`${name}%`, limit, offset];

  try {
    const result = await pool.query(query, values);
    return {
      pills: result.rows,
      total: result.rowCount ?? 0,
      limit,
      offset,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError('DatabaseError', `Failed to search pills by ${searchBy}: ${error.message}`, 500);
    } else {
      throw createError('UnknownError', `Failed to search pills by ${searchBy}: An unknown error occurred`, 500);
    }
  }
};

export const searchPillsbyEfficacy = async (
  efficacy: string,
  limit: number,
  offset: number
): Promise<SearchResult> => {
  const efficacyArray = efficacy.split(',').map((eff) => `%${eff.trim()}%`);
  const query = `
    SELECT * 
    FROM pills 
    WHERE ${efficacyArray
      .map((_, index) => `efficacy ILIKE $${index + 1}`)
      .join(' AND ')}  
    LIMIT $${efficacyArray.length + 1} OFFSET $${efficacyArray.length + 2}`;
  const values = [...efficacyArray, limit, offset];

  try {
    const result = await pool.query(query, values);
    return {
      pills: result.rows,
      total: result.rowCount ?? 0,
      limit,
      offset,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError('DatabaseError', `Failed to search pills by efficacy: ${error.message}`, 500);
    } else {
      throw createError('UnknownError', 'Failed to search pills by efficacy: An unknown error occurred', 500);
    }
  }
};

const searchPillsByFrontAndBack = async (
  front: string,
  back: string,
  limit: number,
  offset: number
): Promise<SearchResult> => {
  const query = `
    SELECT * 
    FROM pillocr 
    WHERE front = $1 AND back = $2
    LIMIT $3 OFFSET $4`;

  const values = [front, back, limit, offset];

  try {
    const result = await pool.query(query, values);
    return {
      pills: result.rows,
      total: result.rowCount ?? 0,
      limit,
      offset,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError('DatabaseError', `${error.message}`, 500);
    } else {
      throw createError('UnknownError', 'An unknown error occurred', 500);
    }
  }
};

const searchPillsByNameFromText = async (
  text: string,
  limit: number,
  offset: number
): Promise<SearchResult> => {
  const query = `
    SELECT * 
    FROM pills 
    WHERE engname ILIKE $1
    LIMIT $2 OFFSET $3`;

  const values = [`%${text}%`, limit, offset];

  try {
    const result = await pool.query(query, values);
    return {
      pills: result.rows,
      total: result.rowCount ?? 0,
      limit,
      offset,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw createError('DatabaseError', `${error.message}`, 500);
    } else {
      throw createError('UnknownError', 'An unknown error occurred', 500);
    }
  }
};

const detectTextInImage = async (imageBuffer: Buffer): Promise<string[]> => {
  try {
    console.log('Detecting text in image...');
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });
    console.log('Vision API result:', result);

    const detections = result.textAnnotations;
    if (detections && detections.length > 0) {
      // Remove numbers, dots, parentheses, square brackets
      const filteredText = detections
        .map((text) => text?.description ?? '')
        .filter((text) => !text.match(/[\.()]/))

      console.log('Filtered text:', filteredText);
      return filteredText;
    }
    console.log('No text detected');
    return [];
  } catch (error) {
    console.error('Error detecting text in image:', error);
    throw createError('VisionAPIError', 'Failed to detect text in the image.', 500);
  }
};

export const searchPillsByImage = async (
  imageBuffer: Buffer,
  limit: number,
  offset: number
): Promise<SearchResult> => {
  try {
    const detectedText = await detectTextInImage(imageBuffer);
    if (!detectedText || detectedText.length === 0) {
      return { pills: [], total: 0, limit, offset };
    }

    let pills: PillData[] = [];
    let total = 0;

    // Search by front and back text in pillocr table
    for (const text of detectedText) {
      if (text) {
        const frontText = detectedText[0];
        const backText = detectedText[1];
        const resultByFrontAndBack = await searchPillsByFrontAndBack(
          frontText,
          backText,
          limit,
          offset
        );
        pills.push(...resultByFrontAndBack.pills);
        total += resultByFrontAndBack.total;
      }
    }

    // If no results from pillocr, search in pills table by name
    if (total === 0) {
      for (const text of detectedText) {
        if (text) {
          const resultByName = await searchPillsByNameFromText(
            text,
            limit,
            offset
          );
          pills.push(...resultByName.pills);
          total += resultByName.total;
        }
      }
    }

    // Remove duplicates based on id
    const uniquePills = Array.from(
      new Map(pills.map((pill) => [pill.id, pill])).values()
    );

    return {
      pills: uniquePills,
      total: uniquePills.length,
      limit,
      offset,
    };
  } catch (error) {
    console.error('Error searching pills by image:', error);
    throw createError('SearchError', 'Failed to search pills by image.', 500);
  }
};

export const getPillFavoriteCountService = async (
  id: number
): Promise<number> => {
  try {
    const query = `
      SELECT COUNT(*) AS count
      FROM favorites
      WHERE pillid = $1
    `;
    const values = [id];
    const { rows } = await pool.query(query, values);

    return parseInt(rows[0].count, 10);
  } catch (error: any) {
    throw createError('DatabaseError', `Failed to get favorite count: ${error.message}`, 500);
  }
};

export const getPillReviewCountService = async (
  id: number
): Promise<number> => {
  try {
    const query = `
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE id = $1
    `;
    const values = [id];
    const { rows } = await pool.query(query, values);

    return parseInt(rows[0].count, 10);
  } catch (error: any) {
    throw createError('DatabaseError', `Failed to get review count: ${error.message}`, 500);
  }
};
