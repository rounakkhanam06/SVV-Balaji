import { PictureOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Product } from '../../api/types';
import { Can } from '../../components/Can';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { RowActions } from '../../components/RowActions';
import {
  useDeleteProduct,
  useProducts,
  useSetProductActive,
} from '../../hooks/useProduction';
import { EM_DASH } from '../../utils/format';

export function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchFilter = (searchParams.get('search') ?? '').toLowerCase();
  const [showDiscontinued, setShowDiscontinued] = useState(true);

  // The catalogue screen asks for discontinued products too - it is the only
  // screen that can reinstate one.
  const products = useProducts(true);
  const setActive = useSetProductActive();
  const remove = useDeleteProduct();

  const rows = (products.data?.data ?? []).filter((p) => {
    const matchesActive = showDiscontinued || p.isActive;
    const matchesSearch = !searchFilter || p.name.toLowerCase().includes(searchFilter) || p.sku.toLowerCase().includes(searchFilter);
    return matchesActive && matchesSearch;
  });
  const discontinuedCount = (products.data?.data ?? []).filter((p) => !p.isActive).length;

  const openEdit = (product: Product) => {
    navigate(`/products/edit/${product.id}`, { state: { from: '/products' } });
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'Photo',
      key: 'image',
      width: 70,
      render: (_, product) => {
        const image = product.images?.[0];
        return (
          <Avatar
            shape="square"
            size={44}
            src={image}
            icon={!image ? <PictureOutlined /> : undefined}
            style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', borderRadius: 8, border: '1px solid #e2e8f0', objectFit: 'cover' }}
          />
        );
      },
    },
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, product) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong type={product.isActive ? undefined : 'secondary'}>
            {name}
          </Typography.Text>
          {product.showOnStorefront ? <Tag color="blue" style={{ width: 'fit-content' }}>Storefront</Tag> : null}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => <Typography.Text code>{sku}</Typography.Text>,
    },
    {
      title: 'Category',
      key: 'category',
      render: (_, product) => product.category?.name ?? EM_DASH,
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 90 },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Active</Tag> : <Tag>Discontinued</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, product) => (
        <RowActions
          entity="product"
          label={product.name}
          can="PRODUCT_MANAGE"
          isActive={product.isActive}
          onEdit={() => openEdit(product)}
          onSetActive={(isActive) => setActive.mutateAsync({ id: product.id, isActive })}
          onDelete={() => remove.mutateAsync(product.id)}
        />
      ),
    },
  ];

  const toolbar = (
    <Space>
      <Switch size="small" checked={showDiscontinued} onChange={setShowDiscontinued} />
      <Typography.Text type="secondary">
        Show discontinued{discontinuedCount > 0 ? ` (${discontinuedCount})` : ''}
      </Typography.Text>
    </Space>
  );

  return (
    <Card>
      <PageHeader
        title="Products"
        subtitle="The catalogue. Every recipe, production run and finished pack refers to one of these."
        actions={
          <Can do="PRODUCT_CREATE">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/add-product', { state: { from: '/products' } })}
            >
              New product
            </Button>
          </Can>
        }
      />

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Catalogue master"
          description="Click Edit on any product to open the 7-tab editor: basic details, B2C/B2B pricing ladder, media, specifications, FAQs, offers, inventory thresholds and pack-size variants."
        />

        <DataTable<Product>
          rows={rows}
          columns={columns}
          rowKey="id"
          isLoading={products.isLoading}
          isFetching={products.isFetching}
          error={products.error}
          onRetry={() => void products.refetch()}
          toolbar={toolbar}
          emptyText="No products yet — one is needed before a recipe can be written"
        />
      </Space>
    </Card>
  );
}
