import { EditOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Button, Descriptions, Drawer, Empty, Form, Input, Space, Spin, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import type { Recipe, RecipeIngredient } from '../../api/types';

/** The written formula: the fixed FRD 19.3 fields that were filled in, then Super Admin's own. */
const formulaRows = (recipe: Recipe) =>
  [
    ['Processing sequence', recipe.processingSequence],
    ['Grinding', recipe.grindingInstructions],
    ['Roasting', recipe.roastingInstructions],
    ['Oil extraction', recipe.oilExtractionProcess],
    ['Packaging', recipe.packagingInstructions],
    ...(recipe.customFields ?? []).map((f) => [f.label, f.value] as const),
  ].filter((row): row is [string, string] => Boolean(row[1]));
import { useRecipeVersions, useSetRecipeHowItsMadeUrl } from '../../hooks/useProduction';
import { Can } from '../../components/Can';
import { HowItsMadeLink } from '../../components/HowItsMadeLink';
import { webLink } from '../../validation/rules';
import { EM_DASH, formatDate, formatQuantity } from '../../utils/format';

interface RecipeVersionsDrawerProps {
  recipeCode: string | null;
  onClose: () => void;
}

const STATUS_COLOURS: Record<string, string> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'gold',
  APPROVED: 'green',
  INACTIVE: 'default',
};

/**
 * Version history for a recipe code (FRD 19.6).
 *
 * Exactly one version of a code is APPROVED at a time — approving a new one
 * retires its predecessor to INACTIVE. Older versions are kept rather than
 * deleted because production batches pin the version they were made from, and a
 * finished pack has to be able to say which formula produced it.
 */
export function RecipeVersionsDrawer({ recipeCode, onClose }: RecipeVersionsDrawerProps) {
  const versions = useRecipeVersions(recipeCode ?? undefined);
  const rows = versions.data?.data ?? [];
  const approved = rows.find((row) => row.status === 'APPROVED');

  return (
    <Drawer
      open={Boolean(recipeCode)}
      onClose={onClose}
      width={720}
      title={recipeCode ? `Versions — ${recipeCode}` : 'Recipe versions'}
    >
      {versions.isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : versions.error ? (
        <Alert type="error" showIcon message={apiErrorMessage(versions.error)} />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {approved ? (
            <Alert
              type="success"
              showIcon
              message={`Version ${approved.version} is live`}
              description="Production runs started now will pin this version. Earlier versions stay on record because batches already made from them refer back to their formula."
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message="No approved version"
              description="Production is refused until a Super Admin approves a version of this recipe."
            />
          )}

          {rows.map((recipe) => (
            <div key={recipe.id}>
              <Space align="center" style={{ marginBottom: 8 }}>
                <Typography.Text strong>Version {recipe.version}</Typography.Text>
                <Tag color={STATUS_COLOURS[recipe.status]}>{recipe.status.replace('_', ' ')}</Tag>
                <Tag>{recipe.productionType === 'MULTI_GRAIN' ? 'Multigrain' : 'Single grain'}</Tag>
              </Space>

              <Descriptions bordered column={2} size="small" style={{ marginBottom: 8 }}>
                <Descriptions.Item label="Name">{recipe.name}</Descriptions.Item>
                <Descriptions.Item label="Yield">
                  {formatQuantity(recipe.batchYieldQuantity, recipe.unit)}
                </Descriptions.Item>
                <Descriptions.Item label="Processing loss">
                  {recipe.expectedLossPercent === null ? EM_DASH : `${Number(recipe.expectedLossPercent)}%`}
                </Descriptions.Item>
                <Descriptions.Item label="Mixing ratio">
                  {recipe.mixingRatio ?? EM_DASH}
                </Descriptions.Item>
                <Descriptions.Item label="Approved">
                  {recipe.approvedAt
                    ? `${formatDate(recipe.approvedAt)}${recipe.approvedBy ? ` by ${recipe.approvedBy.fullName}` : ''}`
                    : EM_DASH}
                </Descriptions.Item>
                <Descriptions.Item label="How it's made" span={2}>
                  <HowItsMadeEditor recipe={recipe} />
                </Descriptions.Item>
                {formulaRows(recipe).map(([label, value]) => (
                  <Descriptions.Item key={label} label={label} span={2}>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
                  </Descriptions.Item>
                ))}
              </Descriptions>

              <Table<RecipeIngredient>
                size="small"
                rowKey="id"
                dataSource={recipe.ingredients ?? []}
                pagination={false}
                locale={{ emptyText: <Empty description="No ingredients recorded" /> }}
                columns={[
                  { title: 'Crop', dataIndex: 'cropName' },
                  {
                    title: 'Quantity',
                    key: 'quantity',
                    align: 'right',
                    render: (_, row) => formatQuantity(row.quantity, row.unit),
                  },
                  {
                    title: '% of blend',
                    dataIndex: 'percentage',
                    align: 'right',
                    render: (value: string | null) => (value === null ? EM_DASH : `${value}%`),
                  },
                ]}
              />
            </div>
          ))}

          {rows.length === 0 ? <Empty description="No versions found" /> : null}
        </Space>
      )}
    </Drawer>
  );
}

/**
 * The link is not formula, so it can be set or changed on any version -
 * approved ones included - without minting a new version.
 */
function HowItsMadeEditor({ recipe }: { recipe: Recipe }) {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm<{ url?: string }>();
  const save = useSetRecipeHowItsMadeUrl();
  const { message } = AntApp.useApp();

  const lastChange = recipe.linkLogs?.[0];
  if (!editing) {
    return (
      <Space size={12} wrap>
        {recipe.howItsMadeUrl ? <HowItsMadeLink url={recipe.howItsMadeUrl} compact /> : EM_DASH}
        {lastChange ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {lastChange.toUrl ? 'Set' : 'Removed'} by {lastChange.changedBy.fullName} on {formatDate(lastChange.createdAt)}
          </Typography.Text>
        ) : null}
        <Can do="RECIPE_CREATE">
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              form.setFieldsValue({ url: recipe.howItsMadeUrl ?? '' });
              setEditing(true);
            }}
          >
            {recipe.howItsMadeUrl ? 'Change' : 'Add link'}
          </Button>
        </Can>
      </Space>
    );
  }

  return (
    <Form
      form={form}
      layout="inline"
      onFinish={async ({ url }) => {
        try {
          await save.mutateAsync({ id: recipe.id, url: url?.trim() || null });
          message.success(url?.trim() ? 'Link saved' : 'Link removed');
          setEditing(false);
        } catch (error) {
          message.error(apiErrorMessage(error, 'Could not save the link'));
        }
      }}
    >
      <Form.Item name="url" rules={[webLink()]} style={{ flex: 1, minWidth: 260 }}>
        <Input placeholder="https://… (empty removes it)" allowClear autoFocus />
      </Form.Item>
      <Button type="primary" size="small" htmlType="submit" loading={save.isPending} style={{ marginTop: 4 }}>
        Save
      </Button>
      <Button size="small" onClick={() => setEditing(false)} style={{ marginTop: 4, marginLeft: 8 }}>
        Cancel
      </Button>
    </Form>
  );
}
