import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  AutoComplete,
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { apiErrorMessage } from '../../api/client';
import type { CreateRecipeInput, ProductionType, RecipeFormOptions } from '../../api/types';
import { useCreateRecipe, useProducts, useRecipeFormOptions, useRecipeVersions } from '../../hooks/useProduction';
import { positiveNumber, required, webLink } from '../../validation/rules';
import { HowItsMadeLink } from '../../components/HowItsMadeLink';
import {
  ingredientUnitFor,
  mixingRatioFrom,
  quantityFromShare,
  remainingShare,
  sharesFromQuantities,
} from './recipeAutofill';

interface RecipeFormModalProps {
  open: boolean;
  onClose: () => void;
}

type IngredientRow = { cropName?: string; quantity?: number; unit?: string; percentage?: number };
type FormValues = CreateRecipeInput & { ingredients: IngredientRow[] };
type CropOption = RecipeFormOptions['crops'][number];

const normaliseCrop = (crop: string) => crop.trim().toLowerCase();

/**
 * Recipe creation (FRD 19), Super Admin only.
 *
 * Two server rules drive this form:
 *
 *   - a SINGLE_GRAIN recipe must have exactly one ingredient; a MULTI_GRAIN one
 *     needs at least two, each with a percentage, summing to 100 (±0.05). The
 *     running total is shown live so the user is not told after submitting.
 *   - reusing an existing recipeCode creates a NEW VERSION rather than editing.
 *     Production batches pin the version they used, so an approved recipe is
 *     never mutated.
 *
 * Filled in as far as it can be: picking a product proposes the name, code and
 * unit; crops come from what the system already knows (production matches
 * batches on crop name, so picking beats typing); with a batch yield set, each
 * ingredient's quantity follows its share of the blend, and without one the
 * shares follow the quantities; the mixing ratio is derived from the shares
 * until someone types their own. Anything filled in can still be overwritten.
 */
export function RecipeFormModal({ open, onClose }: RecipeFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const { message } = AntApp.useApp();
  const products = useProducts();
  const options = useRecipeFormOptions(open);
  const createRecipe = useCreateRecipe();

  const productionType = Form.useWatch('productionType', form) as ProductionType | undefined;
  const ingredients = Form.useWatch('ingredients', form) as IngredientRow[] | undefined;
  const customFields = Form.useWatch('customFields', form) as Array<{ label?: string }> | undefined;
  const howItsMadeUrl = Form.useWatch('howItsMadeUrl', form) as string | undefined;
  const recipeCode = Form.useWatch('recipeCode', form) as string | undefined;
  const productId = Form.useWatch('productId', form) as string | undefined;

  // Reusing a code makes a new VERSION of that recipe - say so before saving, not after.
  const code = useDebouncedValue((recipeCode ?? '').trim().toUpperCase(), 400);
  const existing = useRecipeVersions(open && code ? code : undefined);
  const versions = existing.data?.data ?? [];
  const latest = versions[0];
  const otherProduct = Boolean(latest && productId && latest.productId !== productId);
  const live = versions.find((v) => v.status === 'APPROVED');

  const percentTotal = (ingredients ?? []).reduce((sum, row) => sum + Number(row?.percentage ?? 0), 0);
  const multigrain = productionType === 'MULTI_GRAIN';
  const percentOk = !multigrain || Math.abs(percentTotal - 100) <= 0.05;

  const crops = options.data?.crops ?? [];

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        productionType: 'SINGLE_GRAIN',
        unit: 'KG',
        ingredients: [{ unit: 'KG', percentage: 100 }],
      } as FormValues);
    }
  }, [open, form]);

  /** Re-derive what follows from the yield, the shares and the units. */
  const autofill = (all: FormValues, from: 'shares' | 'quantities') => {
    const rows = [...(all.ingredients ?? [])].map((row) => ({ ...row }));
    const single = all.productionType !== 'MULTI_GRAIN';
    const batchYield = all.batchYieldQuantity;
    const loss = all.expectedLossPercent;
    const unit = ingredientUnitFor(all.unit);

    if (single) {
      rows.forEach((row) => {
        row.percentage = 100;
        const quantity = quantityFromShare(batchYield, 100, loss);
        if (quantity !== undefined) row.quantity = quantity;
      });
    } else if (from === 'quantities' && !batchYield) {
      const shares = sharesFromQuantities(rows.map((row) => row.quantity));
      if (shares) rows.forEach((row, i) => (row.percentage = shares[i]));
    } else {
      rows.forEach((row) => {
        const quantity = quantityFromShare(batchYield, row.percentage, loss);
        if (quantity !== undefined) row.quantity = quantity;
      });
    }
    if (unit) rows.forEach((row) => (row.unit = unit));

    const patch: Partial<FormValues> = { ingredients: rows as FormValues['ingredients'] };
    if (!form.isFieldTouched('mixingRatio')) {
      patch.mixingRatio = single ? '' : mixingRatioFrom(rows.map((row) => row.percentage));
    }
    form.setFieldsValue(patch);
  };

  const handleValuesChange = (changed: Partial<FormValues>, all: FormValues) => {
    if (changed.productId) {
      const product = products.data?.data.find((p) => p.id === changed.productId);
      if (product) {
        const patch: Partial<FormValues> = {};
        if (!form.getFieldValue('name')) patch.name = product.name;
        if (!form.getFieldValue('recipeCode')) patch.recipeCode = product.sku.toUpperCase();
        if (['KG', 'LITRE', 'PACK'].includes(product.unit)) patch.unit = product.unit;
        form.setFieldsValue(patch);
        all = { ...all, ...patch };
        if (patch.unit) autofill(all, 'shares');
      }
      return;
    }

    if (changed.productionType === 'SINGLE_GRAIN' && (all.ingredients?.length ?? 0) > 1) {
      // A single-grain recipe has exactly one ingredient; keep the first.
      all = { ...all, ingredients: all.ingredients.slice(0, 1) };
    }

    if ('batchYieldQuantity' in changed || 'expectedLossPercent' in changed || 'productionType' in changed || 'unit' in changed) {
      autofill(all, 'shares');
      return;
    }

    // Form.List reports the edited row only: a sparse array holding just the field that changed.
    const editedRows = (changed.ingredients ?? []).filter(Boolean) as IngredientRow[];
    if (editedRows.some((row) => 'percentage' in row)) autofill(all, 'shares');
    else if (editedRows.some((row) => 'quantity' in row)) autofill(all, 'quantities');
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (values.productionType === 'MULTI_GRAIN' && !percentOk) {
      message.error(`Ingredient percentages must total 100 — currently ${percentTotal.toFixed(2)}`);
      return;
    }
    if (otherProduct) {
      message.error(`Recipe code ${code} belongs to ${latest?.product?.name ?? 'another product'} — choose a new code`);
      return;
    }

    const product = products.data?.data.find((p) => p.id === values.productId);
    const input: CreateRecipeInput = {
      ...values,
      category: product?.category?.name,
      ingredients: values.ingredients.map((row) => ({
        cropName: (row.cropName ?? '').trim(),
        quantity: Number(row.quantity ?? 0),
        unit: row.unit,
        percentage: values.productionType === 'MULTI_GRAIN' ? row.percentage : undefined,
      })),
      howItsMadeUrl: values.howItsMadeUrl?.trim() || undefined,
      customFields: (values.customFields ?? [])
        .map((f) => ({ label: (f?.label ?? '').trim(), value: (f?.value ?? '').trim() }))
        .filter((f) => f.label && f.value),
    };

    try {
      const recipe = await createRecipe.mutateAsync(input);
      message.success(
        `${recipe.recipeCode} v${recipe.version} created as DRAFT — a Super Admin must approve it before production`,
        6,
      );
      onClose();
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not create the recipe'));
    }
  };

  const usedLabels = new Set((customFields ?? []).map((f) => (f?.label ?? '').trim().toLowerCase()).filter(Boolean));
  const labelOptions = (options.data?.customFieldLabels ?? [])
    .filter((label) => !usedLabels.has(label.toLowerCase()))
    .map((label) => ({ value: label }));

  return (
    <Modal
      open={open}
      title="New recipe"
      okText="Create recipe"
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={createRecipe.isPending}
      width={860}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark preserve={false} onValuesChange={handleValuesChange}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="productId" label="Product" rules={[required('Product')]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={products.isLoading}
                placeholder="Select a product"
                options={(products.data?.data ?? []).map((product) => ({
                  value: product.id,
                  label: `${product.name} (${product.sku})`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="recipeCode"
              label="Recipe code"
              rules={[required('Recipe code')]}
              validateStatus={otherProduct ? 'error' : latest ? 'warning' : undefined}
              extra={
                !code ? (
                  'Reusing an existing code creates a new version.'
                ) : existing.isFetching && !latest ? (
                  'Checking…'
                ) : otherProduct ? (
                  `Already used for ${latest?.product?.name ?? 'another product'} — choose a new code.`
                ) : latest ? (
                  `Saves as version ${latest.version + 1} of ${code}${live ? ` — v${live.version} stays live until this one is approved` : ''}.`
                ) : (
                  'New recipe code — saves as version 1.'
                )
              }
              normalize={(v?: string) => v?.toUpperCase()}
            >
              <Input placeholder="MG-ATTA" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="name" label="Recipe name" rules={[required('Name')]}>
              <Input placeholder="Multigrain Atta — standard blend" />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item name="productionType" label="Type" rules={[required('Type')]}>
              <Select
                options={[
                  { value: 'SINGLE_GRAIN', label: 'Single grain' },
                  { value: 'MULTI_GRAIN', label: 'Multigrain (blend)' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item
              name="batchYieldQuantity"
              label="Expected yield per batch"
              rules={[positiveNumber('Yield')]}
              extra="Finished output. Ingredient input is worked out from it."
            >
              <InputNumber style={{ width: '100%' }} min={0} step={10} placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item
              name="expectedLossPercent"
              label="Processing loss"
              extra="Weight lost cleaning / grinding / roasting."
            >
              <InputNumber style={{ width: '100%' }} min={0} max={99} step={0.5} addonAfter="%" placeholder="0" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="unit" label="Unit">
              <Select options={['KG', 'LITRE', 'PACK'].map((unit) => ({ value: unit, label: unit }))} />
            </Form.Item>
          </Col>
        </Row>

        {multigrain ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="These percentages become a production rule"
            description="Once this version is approved, every run made from it has to hold this ratio to within half a percentage point of the total input — the server refuses anything further out. Set them to what the blend actually is, not to what is convenient here."
          />
        ) : null}

        <Divider orientation="left" plain>
          Ingredients{' '}
          {multigrain ? (
            <Typography.Text type={percentOk ? 'success' : 'danger'}>
              — {percentTotal.toFixed(2)}% of 100
            </Typography.Text>
          ) : null}
        </Divider>

        <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
          Pick crops from the list — production matches raw material batches to ingredients by crop name, so a name
          typed differently from the batches means the run is refused.
          {multigrain
            ? ' With a yield set, quantities follow the % (plus the processing loss); without one, the % follows the quantities.'
            : ' With a yield set, the quantity is the yield plus the processing loss.'}
        </Typography.Paragraph>

        <Form.List name="ingredients">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => {
                const taken = new Set(
                  (ingredients ?? [])
                    .filter((_, i) => i !== field.name)
                    .map((row) => normaliseCrop(row?.cropName ?? ''))
                    .filter(Boolean),
                );
                return (
                  <Row gutter={8} key={field.key} align="top">
                    <Col xs={24} md={8}>
                      <Form.Item
                        name={[field.name, 'cropName']}
                        rules={[required('Crop')]}
                        label={field.name === 0 ? 'Crop' : undefined}
                      >
                        <CropSelect crops={crops} loading={options.isLoading} taken={taken} />
                      </Form.Item>
                    </Col>
                    <Col xs={8} md={5}>
                      <Form.Item
                        name={[field.name, 'percentage']}
                        label={field.name === 0 ? '% of blend' : undefined}
                        rules={multigrain ? [{ required: true, message: 'Required for a blend' }] : undefined}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          max={100}
                          step={0.5}
                          addonAfter="%"
                          disabled={!multigrain}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={8} md={5}>
                      <Form.Item
                        name={[field.name, 'quantity']}
                        rules={[required('Quantity'), positiveNumber('Quantity')]}
                        label={field.name === 0 ? 'Quantity' : undefined}
                      >
                        <InputNumber style={{ width: '100%' }} min={0} step={1} />
                      </Form.Item>
                    </Col>
                    <Col xs={6} md={4}>
                      <Form.Item name={[field.name, 'unit']} label={field.name === 0 ? 'Unit' : undefined}>
                        <Select options={['KG', 'GRAM', 'LITRE'].map((u) => ({ value: u, label: u }))} />
                      </Form.Item>
                    </Col>
                    <Col xs={2} md={2}>
                      <Form.Item label={field.name === 0 ? ' ' : undefined}>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          disabled={fields.length === 1}
                          onClick={() => {
                            remove(field.name);
                            autofill(form.getFieldsValue(true) as FormValues, 'shares');
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              })}

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                disabled={!multigrain && fields.length >= 1}
                onClick={() => {
                  const all = form.getFieldsValue(true) as FormValues;
                  const share = remainingShare((all.ingredients ?? []).map((row) => row?.percentage));
                  add({
                    unit: ingredientUnitFor(all.unit) ?? 'KG',
                    percentage: share,
                    quantity: quantityFromShare(all.batchYieldQuantity, share, all.expectedLossPercent),
                  });
                  autofill(form.getFieldsValue(true) as FormValues, 'shares');
                }}
              >
                {!multigrain && fields.length >= 1
                  ? 'A single-grain recipe has exactly one ingredient'
                  : 'Add ingredient'}
              </Button>
            </>
          )}
        </Form.List>

        <Divider orientation="left" plain>
          Production formula (FRD 19.3)
        </Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="mixingRatio"
              label="Mixing ratio"
              extra={multigrain ? 'Filled in from the % of blend until you type your own.' : undefined}
            >
              <Input placeholder="Optional — e.g. 4:3:2:1" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="processingSequence" label="Processing sequence">
              <Input placeholder="Optional — e.g. clean → grind → blend" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="grindingInstructions" label="Grinding">
              <Input.TextArea rows={2} placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="roastingInstructions" label="Roasting">
              <Input.TextArea rows={2} placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="oilExtractionProcess" label="Oil extraction">
              <Input.TextArea rows={2} placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="packagingInstructions" label="Packaging">
              <Input.TextArea rows={2} placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>

        <Form.List name="customFields">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Row gutter={8} key={field.key} align="top">
                  <Col xs={24} md={8}>
                    <Form.Item
                      name={[field.name, 'label']}
                      label={field.name === 0 ? 'Field name' : undefined}
                      rules={[
                        required('Field name'),
                        { max: 60, message: 'Keep it under 60 characters' },
                        {
                          validator: (_, value?: string) => {
                            const key = (value ?? '').trim().toLowerCase();
                            const clash = (customFields ?? []).some(
                              (f, i) => i !== field.name && (f?.label ?? '').trim().toLowerCase() === key,
                            );
                            return key && clash ? Promise.reject(new Error('Already added')) : Promise.resolve();
                          },
                        },
                      ]}
                    >
                      <AutoComplete
                        options={labelOptions}
                        filterOption={(input, option) =>
                          String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        placeholder="e.g. Sieve size"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={22} md={14}>
                    <Form.Item
                      name={[field.name, 'value']}
                      label={field.name === 0 ? 'Value' : undefined}
                      rules={[required('Value')]}
                    >
                      <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} placeholder="e.g. 60 mesh" />
                    </Form.Item>
                  </Col>
                  <Col xs={2} md={2}>
                    <Form.Item label={field.name === 0 ? ' ' : undefined}>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </Form.Item>
                  </Col>
                </Row>
              ))}
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                style={{ marginBottom: 24 }}
                disabled={fields.length >= 30}
                onClick={() => add({ label: '', value: '' })}
              >
                Add field
              </Button>
            </>
          )}
        </Form.List>

        <Form.Item
          name="howItsMadeUrl"
          label="How it's made — video or page link"
          rules={[webLink()]}
          extra="Shown on the product page once this version is approved, unless the product has its own link. Can be changed later without a new version."
        >
          <Input placeholder="Optional — YouTube, Instagram or any link" allowClear />
        </Form.Item>
        <HowItsMadeLink url={howItsMadeUrl?.trim()} compact />

        <Form.Item name="description" label="Description" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} placeholder="Optional" />
        </Form.Item>

        <Space />
      </Form>
    </Modal>
  );
}

/**
 * Searchable crop picker over every crop the system already knows, showing
 * stock on hand. A name not in the list can still be used (a crop not yet
 * procured), but it is flagged so it is a deliberate choice.
 */
function CropSelect({
  value,
  onChange,
  crops,
  loading,
  taken,
}: {
  value?: string;
  onChange?: (value: string) => void;
  crops: CropOption[];
  loading: boolean;
  taken: Set<string>;
}) {
  const [search, setSearch] = useState('');
  const typed = search.trim();
  const known = (name: string) => crops.some((c) => normaliseCrop(c.cropName) === normaliseCrop(name));

  const list: Array<{ value: string; label: string; crop?: CropOption; disabled?: boolean }> = crops.map((crop) => ({
    value: crop.cropName,
    label: crop.cropName,
    crop,
    disabled: taken.has(normaliseCrop(crop.cropName)),
  }));
  if (value && !known(value)) list.unshift({ value, label: value });
  if (typed && !known(typed) && normaliseCrop(typed) !== normaliseCrop(value ?? '')) {
    list.push({ value: typed, label: typed, disabled: taken.has(normaliseCrop(typed)) });
  }

  return (
    <Select
      showSearch
      value={value || undefined}
      onChange={(next: string) => {
        onChange?.(next);
        setSearch('');
      }}
      onSearch={setSearch}
      loading={loading}
      placeholder="Search crops"
      optionFilterProp="label"
      notFoundContent={loading ? 'Loading…' : 'Type a crop name'}
      options={list}
      optionRender={(option) => {
        const crop = (option.data as { crop?: CropOption }).crop;
        if (!crop) {
          return (
            <Space size={4}>
              <span>{option.label}</span>
              <Tag color="orange">new — no batches yet</Tag>
            </Space>
          );
        }
        return (
          <Space size={4} style={{ width: '100%', justifyContent: 'space-between' }}>
            <span>{crop.cropName}</span>
            {crop.availableQuantity > 0 ? (
              <Tag color="green">
                {crop.availableQuantity.toLocaleString('en-IN')} {crop.unit} in stock
              </Tag>
            ) : (
              <Tag>{crop.batchCount ? 'no stock' : crop.seenIn[0]}</Tag>
            )}
          </Space>
        );
      }}
    />
  );
}
