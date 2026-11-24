import type { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';

export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { company } = req.query;
    const query: any = {};
    if (company && typeof company === 'string' && company.trim() && company.trim().toUpperCase() !== 'ALL') {
      const escaped = company.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.company = { $regex: new RegExp(`^${escaped}$`, 'i') };
    }
    const products = await Product.find(query).sort({ slNo: 1, createdAt: 1 });
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { company, products } = req.body;
    const items = Array.isArray(products) ? products : (Array.isArray(req.body) ? req.body : []);

    if (!items || items.length === 0) {
      res.status(400).json({ success: false, error: 'No products provided for bulk upload' });
      return;
    }

    const lastProduct = await Product.findOne().sort({ slNo: -1 }).select('slNo').lean();
    let currentSlNo = (lastProduct && typeof lastProduct.slNo === 'number') ? lastProduct.slNo : 0;

    const toInsert = items.map((item: any) => {
      currentSlNo++;
      return {
        slNo: currentSlNo,
        name: String(item.name || '').trim(),
        code: item.code ? String(item.code).trim() : '',
        category: item.category ? String(item.category).trim() : '',
        rate: Number(item.rate) || 0,
        pktUnit: item.pktUnit !== undefined && item.pktUnit !== null ? String(item.pktUnit).trim() : '1',
        caseCount: Number(item.caseCount ?? item.case ?? item.cases) || 0,
        company: (item.company || company || '').trim(),
      };
    }).filter((item: any) => item.name.length > 0);

    if (toInsert.length === 0) {
      res.status(400).json({ success: false, error: 'No valid products with names found' });
      return;
    }

    const created = await Product.insertMany(toInsert);
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (error) {
    next(error);
  }
};
