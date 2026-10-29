import django.db.models.deletion
import core.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_alter_customer_phone"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="orderitem",
            name="product_name_at_order",
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_description_at_order",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="customer_name_at_order",
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="quantity_at_order",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="unit_price_at_order",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="customer",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.customer"),
        ),
        migrations.AlterField(
            model_name="orderitem",
            name="product",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="core.product"),
        ),
        migrations.CreateModel(
            name="OrderItemLifecycle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("delivery_photo", models.ImageField(blank=True, null=True, upload_to=core.models.delivery_photo_upload_to)),
                ("delivery_confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("billing_completed_at", models.DateTimeField(blank=True, null=True)),
                ("payment_received_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("billing_completed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="item_billing_completions_confirmed", to=settings.AUTH_USER_MODEL)),
                ("delivery_confirmed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="item_deliveries_confirmed", to=settings.AUTH_USER_MODEL)),
                ("order_item", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="lifecycle", to="core.orderitem")),
                ("payment_received_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="item_payments_confirmed", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
