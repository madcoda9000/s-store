using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace sstore.Migrations
{
    /// <inheritdoc />
    public partial class AddTwoFactorMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TwoFactorMethod",
                table: "AspNetUsers",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TwoFactorMethod",
                table: "AspNetUsers");
        }
    }
}
